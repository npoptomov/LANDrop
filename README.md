# LAN Drop

Share files between your computer and phone over the same Wi-Fi. Works on **macOS, Windows, and Linux**. Open it in a browser on each device—there's nothing to install on your phone.

**[Download ZIP](https://github.com/npoptomov/LANDrop/archive/refs/heads/main.zip)** · [Report a problem](https://github.com/npoptomov/LANDrop/issues)

## Setup

Install **Node.js 18 or newer** on your computer, then download and unzip this project. You don't need to run `npm install`.

### macOS

1. Open the extracted folder and double-click **start.command**.
2. Keep the terminal window open.
3. Open **http://localhost:8797** in your browser.

If the launcher won't open, open Terminal, type `cd `, drag the extracted folder into the window, and press Return. Then run:

```sh
node server.mjs
```

If macOS asks about incoming connections, allow Node on your private network.

### Windows

1. Open the extracted folder in File Explorer.
2. Type `powershell` in the address bar and press Enter.
3. Run:

```powershell
node server.mjs
```

4. Open **http://localhost:8797** in your browser.

If Windows Firewall asks, allow Node on **Private networks**. Keep PowerShell open while sharing. If `node` isn't recognized after installation, close PowerShell and open it again.

### Linux

1. Open a terminal in the extracted folder. Many file managers have an **Open in Terminal** option.
2. Run:

```sh
node server.mjs
```

3. Open **http://localhost:8797** in your browser.

If you use a firewall, allow incoming TCP connections on port **8797** from your local network. Keep the terminal open while sharing.

### Connect your phone or another computer

Connect it to the same Wi-Fi and open the network address printed in the server terminal. It will look something like `http://192.168.1.20:8797`—use the address shown on your own computer.

`localhost` only works on the computer running the server. Press **Ctrl+C** in its terminal when you're done sharing.

## Send files

Drop files onto the page or click the upload area to choose them. On your other device, tap **Download**. It works in both directions, and the file list updates automatically.

Files can be up to **25 MiB each**. Uploaded files stay in `shared/` after you close the app, so they're available when you start it again. The page follows your device's light or dark theme.

## Pick a shared folder

Put files in `send-folder/` inside the project folder, then click **Refresh** in the **Shared folder** panel.

Want to use a different folder? Create a file named `folder-config.json` next to `server.mjs`. Use one of these examples, replacing the path with your own:

**macOS**

```json
{ "folder": "/Users/yourname/Desktop/Shared Files" }
```

**Windows** — use forward slashes in this file:

```json
{ "folder": "C:/Users/yourname/Desktop/Shared Files" }
```

**Linux**

```json
{ "folder": "/home/yourname/Shared Files" }
```

Restart the server after changing the folder. On Windows, make sure the file is named `folder-config.json`, not `folder-config.json.txt`.

Click **Download** to get a file directly from the folder. **Share selected** makes a copy in the shared file list, so it stays available even if you move or replace the original.

Only files directly in the folder appear. Subfolders, hidden files, symbolic links, and files over the size limit are skipped.

## Change the port

If another app is using port 8797, stop LAN Drop and start it with a different one.

**macOS / Linux**

```sh
PORT=8897 node server.mjs
```

**Windows PowerShell**

```powershell
$env:PORT = "8897"
node server.mjs
```

Then use **http://localhost:8897** on the computer and the newly printed address on your phone.

<details>
<summary>More folder settings</summary>

You can set `LAN_DROP_SEND_FOLDER` instead of using `folder-config.json`. It takes priority over that file. Set `LAN_DROP_DATA_FOLDER` to change where uploads and the shared file list are saved; the default is `shared/` beside the server.

On macOS or Linux:

```sh
LAN_DROP_SEND_FOLDER="/path/to/files" node server.mjs
```

In Windows PowerShell:

```powershell
$env:LAN_DROP_SEND_FOLDER = "C:/Users/yourname/Desktop/Shared Files"
node server.mjs
```

`folder-config.example.json` is also included. Its example points to a sibling folder called `Phone Builds`. Relative paths are resolved from the directory where you start the server, so run it from the project folder.

</details>

## Can't connect?

- Check that both devices are on the same Wi-Fi. Guest networks sometimes block connections between devices.
- Use the address printed in the terminal on your phone, not `localhost`.
- Check your firewall and try disconnecting your VPN.
- Keep the computer awake and the server running.

## Who can access the files?

Anyone who can reach the server can upload and download files, including files in your chosen shared folder. There's no password, and transfers use plain HTTP. Use a trusted local network and don't forward the port to the internet.

Your uploads and folder settings stay on your computer and are excluded from Git. Making this repository public doesn't publish those files.
