# LAN Drop

LAN Drop is a tiny local-network sharing room for a MacBook and phone. Choose or drop files to share them between devices, or download directly from the shared Mac folder.

## Start it on the MacBook

1. Make sure the MacBook and phone are on the same Wi-Fi.
2. Double-click `start.command`, or open Terminal in this folder and run `node server.mjs`.
3. Open `http://localhost:8797` on the MacBook.
4. Open the printed Wi-Fi link on your phone. No code is required.

Drag one or more files onto the page to share them, or tap the drop area to choose files.

The app needs Node.js 18 or newer and has no packages to install. If macOS asks whether Node may accept incoming connections, allow it for the private network.

## Notes

- The room is reachable only while the server is running.
- File metadata are saved locally in the generated `shared/` folder. Uploaded files are stored in `shared/files/`.
- Files are limited to 25 MB.
- Anyone who can reach this MacBook on the network can access the room. Stop the server with `Control-C` when finished.
- If the phone cannot connect, check that the Wi-Fi does not have client isolation enabled and that a VPN is not routing the phone away from the local network.

## Files from a Mac folder

The **Shared folder** panel lists files in a dedicated Mac folder. Select the files and click **Share selected** to add persistent copies to the room, or download them directly from the phone. Click **Refresh** after adding builds. Existing drag-and-drop and file uploads still work.

The default is `send-folder/` beside the server. To choose another folder, set `LAN_DROP_SEND_FOLDER` before starting, or set `{"folder":"/absolute/path/to/folder"}` in `folder-config.json` beside `server.mjs`. Only immediate regular files up to 25 MB are listed; hidden files, subfolders and symbolic links are excluded. Anyone on the local network with access to the room can download these files.
