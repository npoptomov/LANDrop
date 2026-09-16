# LAN Drop

Drop a file on your Mac. Pick it up on your phone—or send one back.

LAN Drop is a small browser-based file-sharing app for devices on the same Wi-Fi. It has a shared file list, a folder you choose on your computer, and a dark/light theme that follows your device. No account, pairing code, or phone app needed.

**[Download the source ZIP](https://github.com/npoptomov/LANDrop/archive/refs/heads/main.zip)** · [Report a problem](https://github.com/npoptomov/LANDrop/issues)

## Get started

You need **Node.js 18 or newer** on the computer. There are no npm packages to install.

1. Download and unzip this project, or clone it:

   ```sh
   git clone https://github.com/npoptomov/LANDrop.git
   cd LANDrop
   ```

2. On macOS, double-click **start.command**. You can also open a terminal in the project folder and run:

   ```sh
   node server.mjs
   ```

3. Open **http://localhost:8797** on the computer.
4. Connect your phone to the same Wi-Fi and open the network address printed in the terminal. Keep the server running while you share.

The Mac launcher is optional. On Windows or Linux, use the terminal command above. The phone only needs a browser.

## Share a file

**Computer → phone:** drop files onto the page, or click the upload area to choose them. Open the same room on your phone and tap Download.

**Phone → computer:** choose files on the phone's page, then download them from the computer's page. The shared list updates automatically.

Files can be up to **25 MiB each**. Uploads stay in the local `shared/` folder between restarts.

## Share a folder

The **Shared folder** panel shows files from `send-folder/` by default. Put files there and click **Refresh** to see them.

To use your own folder, create `folder-config.json` beside `server.mjs`:

```json
{
  "folder": "/absolute/path/to/your/shared-folder"
}
```

Restart the server after changing the configuration. You can copy `folder-config.example.json` as a starting point; its example uses a sibling folder named `Phone Builds`. Relative paths are resolved from the directory where you start the server, so run it from the project folder.

- **Download** gets a file directly from that folder.
- **Share selected** adds a separate copy to the shared file list. That copy remains available if you later move or replace the original.
- Only files directly inside the folder are listed. Hidden files, subfolders, symbolic links, and files over the size limit are skipped.

## Other settings

<details>
<summary>Change the port or storage folders</summary>

The default port is **8797**. To choose another port on macOS or Linux:

```sh
PORT=8897 node server.mjs
```

You can also set folders through environment variables:

```sh
LAN_DROP_SEND_FOLDER="/path/to/files" node server.mjs
LAN_DROP_DATA_FOLDER="/path/to/saved-uploads" node server.mjs
```

`LAN_DROP_SEND_FOLDER` takes priority over `folder-config.json`. `LAN_DROP_DATA_FOLDER` changes where uploads and file-list metadata are stored; its default is `shared/` beside the server.

</details>

## If your phone can't connect

- Use the network address printed by the server, **not localhost** on the phone.
- Check that both devices are on the same Wi-Fi. Guest networks may block devices from reaching each other.
- Allow Node through the computer's firewall for your private network.
- Check whether a VPN is blocking local connections.
- Keep the computer awake and the server terminal open. Press **Ctrl+C** to stop it.

## Keep sharing local

There is **no login or access code**. Anyone who can reach the server can upload files, download shared files, and browse the configured shared folder. Transfers use plain HTTP. Use it on a trusted local network and don't expose the port to the internet.

Files stay on the computer running the server; there is no hosted storage service. The public GitHub repository contains the app's source code—your uploads and local folder configuration are excluded from Git.
