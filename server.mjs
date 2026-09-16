import { createServer } from "node:http";
import { constants, createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile, readdir, open } from "node:fs/promises";
import { networkInterfaces, hostname } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(appRoot, "public");
const dataRoot = process.env.LAN_DROP_DATA_FOLDER || path.join(appRoot, "shared");
const filesRoot = path.join(dataRoot, "files");
const statePath = path.join(dataRoot, "state.json");
const port = Number.parseInt(process.env.PORT || "8797", 10);
const maxFileBytes = 25 * 1024 * 1024;
const maxItems = 500;

let folderConfig = {};
try { folderConfig = JSON.parse(await readFile(path.join(appRoot, "folder-config.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const sendFolder = path.resolve(process.env.LAN_DROP_SEND_FOLDER || folderConfig.folder || path.join(appRoot, "send-folder"));
await mkdir(sendFolder, { recursive: true });

const clients = new Set();
let items = [];
let saveQueue = Promise.resolve();

await mkdir(filesRoot, { recursive: true });
items = await loadState();

function normalizeSender(value) {
  const sender = String(value || "This device").replace(/[\r\n]/g, " ").trim();
  return sender.slice(0, 32) || "This device";
}

function sanitizeFileName(value) {
  const name = String(value || "download").replace(/[\\/\0\r\n]/g, "-").trim();
  return (name || "download").slice(0, 160);
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadState() {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && item.id && item.createdAt)
      .slice(0, maxItems);
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Could not load shared state:", error.message);
    return [];
  }
}

function persistState() {
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => writeFile(statePath, JSON.stringify(items, null, 2), "utf8"));
  return saveQueue;
}

function jsonResponse(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function textResponse(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}


function getLanAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

function getShareUrls() {
  return getLanAddresses().map(
    (address) => `http://${address}:${port}/`,
  );
}

function readRequestBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    request.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > limit) {
        settled = true;
        reject(new Error("request_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

async function readJson(request, limit) {
  const body = await readRequestBody(request, limit);
  return JSON.parse(body.toString("utf8"));
}

function eventMessage(type, payload) {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

function broadcast(type, payload) {
  const message = eventMessage(type, payload);
  for (const client of clients) {
    try {
      client.response.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function addItem(item) {
  items.unshift(item);
  items = items.slice(0, maxItems);
  broadcast("item", { item });
  return persistState();
}

async function serveStatic(response, pathname) {
  const staticFiles = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  };
  const file = staticFiles[pathname];
  if (!file) {
    textResponse(response, 404, "Not found");
    return;
  }

  try {
    const filePath = path.join(publicRoot, file[0]);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": file[1],
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch {
    textResponse(response, 500, "The app is missing a public file.");
  }
}

async function handleConfig(request, response, url) {
  jsonResponse(response, 200, {
    shareUrls: getShareUrls(),
    hostName: hostname().split(".")[0],
    maxFileBytes,
    maxFileLabel: formatBytes(maxFileBytes),
  });
}

async function handleItems(request, response) {
  if (request.method !== "GET") {
    jsonResponse(response, 405, { error: "Only file sharing is supported" });
    return;
  }
  jsonResponse(response, 200, { items: items.filter(item => item.kind === "file") });
}

async function handleUpload(request, response, url) {
  if (request.method !== "POST") {
    jsonResponse(response, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const body = await readJson(request, Math.ceil(maxFileBytes * 1.42) + 100_000);
    const encoded = String(body.data || "");
    const buffer = Buffer.from(encoded, "base64");
    if (!encoded || !buffer.length || buffer.length > maxFileBytes) {
      jsonResponse(response, 413, { error: "file_too_large_or_empty", maxFileBytes });
      return;
    }

    const id = randomUUID();
    await writeFile(path.join(filesRoot, id), buffer, { flag: "wx" });
    const item = {
      id,
      kind: "file",
      name: sanitizeFileName(body.name),
      mime: String(body.mime || "application/octet-stream").slice(0, 120),
      size: buffer.length,
      sender: normalizeSender(body.sender),
      createdAt: new Date().toISOString(),
    };
    await addItem(item);
    jsonResponse(response, 201, { item });
  } catch (error) {
    const status = error.message === "request_too_large" ? 413 : 400;
    jsonResponse(response, status, { error: status === 413 ? "file_too_large" : "upload_failed" });
  }
}

async function handleDownload(request, response, url, id) {
  const item = items.find((candidate) => candidate.id === id && candidate.kind === "file");
  if (!item) {
    textResponse(response, 404, "File not found");
    return;
  }

  const filePath = path.join(filesRoot, id);
  try {
    const fileStat = await stat(filePath);
    response.writeHead(200, {
      "Content-Type": item.mime || "application/octet-stream",
      "Content-Length": fileStat.size,
      "Content-Disposition": `attachment; filename="${sanitizeFileName(item.name).replace(/"/g, "'")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    textResponse(response, 404, "File not found");
  }
}

// Expose only regular, non-symlink files directly inside the configured folder.
async function openFolderFile(name) {
  if (typeof name !== "string" || !name || name.startsWith(".") || /[\\/\0]/.test(name)) throw new Error("invalid_file");
  const handle = await open(path.join(sendFolder, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxFileBytes) throw new Error("invalid_file");
    return { handle, info };
  } catch (error) { await handle.close(); throw error; }
}

async function handleFolder(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/folder") {
    const files = [];
    for (const entry of await readdir(sendFolder, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      try {
        const { handle, info } = await openFolderFile(entry.name);
        await handle.close();
        files.push({ name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() });
      } catch { /* File removed or replaced while refreshing. */ }
    }
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
    jsonResponse(response, 200, { folder: sendFolder, files });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/folder/download") {
    let opened;
    try { opened = await openFolderFile(url.searchParams.get("name")); }
    catch { jsonResponse(response, 404, { error: "File unavailable in the shared folder" }); return; }
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": opened.info.size,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(url.searchParams.get("name"))}`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    });
    const stream = opened.handle.createReadStream();
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/folder/share") {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
      jsonResponse(response, 403, { error: "origin_not_allowed" }); return;
    }
    let body;
    try { body = await readJson(request, 20000); } catch { jsonResponse(response, 400, { error: "invalid_json" }); return; }
    if (!Array.isArray(body.names) || !body.names.length || body.names.length > 50) {
      jsonResponse(response, 400, { error: "Choose between 1 and 50 files" }); return;
    }
    const shared = [], failed = [];
    for (const name of [...new Set(body.names)]) {
      let handle;
      try {
        const opened = await openFolderFile(name); handle = opened.handle;
        // Read only the validated size, even if another process grows the file.
        const buffer = Buffer.alloc(opened.info.size);
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
          if (!bytesRead) throw new Error("file_changed");
          offset += bytesRead;
        }
        const id = randomUUID();
        await writeFile(path.join(filesRoot, id), buffer, { flag: "wx" });
        const item = { id, kind: "file", name: sanitizeFileName(name), size: buffer.length,
          mime: name.toLowerCase().endsWith(".apk") ? "application/vnd.android.package-archive" : "application/octet-stream",
          sender: normalizeSender(body.sender || "MacBook folder"), createdAt: new Date().toISOString() };
        await addItem(item); shared.push(item);
      } catch { failed.push(name); }
      finally { if (handle) await handle.close(); }
    }
    jsonResponse(response, 200, { items: shared, failed }); return;
  }
  jsonResponse(response, 405, { error: "method_not_allowed" });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/api/folder" || url.pathname.startsWith("/api/folder/")) {
      await handleFolder(request, response, url); return;
    }
    if (url.pathname === "/api/config" && request.method === "GET") {
      await handleConfig(request, response, url);
      return;
    }
    if (url.pathname === "/api/items") {
      await handleItems(request, response, url);
      return;
    }
    if (url.pathname === "/api/upload") {
      await handleUpload(request, response, url);
      return;
    }
    if (url.pathname.startsWith("/download/")) {
      await handleDownload(request, response, url, url.pathname.slice("/download/".length));
      return;
    }
    if (url.pathname === "/events" && request.method === "GET") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.write(`retry: 2500\n${eventMessage("snapshot", { items: items.filter(item => item.kind === "file") })}`);
      const client = { response };
      clients.add(client);
      request.on("close", () => clients.delete(client));
      return;
    }
    if (request.method === "GET") {
      await serveStatic(response, url.pathname);
      return;
    }
    jsonResponse(response, 404, { error: "not_found" });
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) jsonResponse(response, 500, { error: "server_error" });
    else response.end();
  }
});

setInterval(() => {
  for (const client of clients) {
    try {
      client.response.write(": keep-alive\n\n");
    } catch {
      clients.delete(client);
    }
  }
}, 20_000).unref();

server.listen(port, "0.0.0.0", () => {
  const shareUrls = getShareUrls();
  console.log("");
  console.log("  LAN DROP is running");
  console.log(`  On this Mac:  http://localhost:${port}/`);
  if (shareUrls.length) {
    console.log("  Open on your phone:");
    for (const shareUrl of shareUrls) console.log(`    ${shareUrl}`);
  } else {
    console.log("  No Wi-Fi address found yet. Check that this Mac is connected to Wi-Fi.");
  }
  console.log("");
});

function shutdown() {
  for (const client of clients) client.response.end();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
