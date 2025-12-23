import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {PopupMenu, PopupMenuItem, PopupSeparatorMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export default class FlatpakUninstallExtension extends Extension {
    enable() {
        this._originalOpen = PopupMenu.prototype.open;
        const extension = this;

        PopupMenu.prototype.open = function(animate) {
            extension._originalOpen.call(this, animate);

            const app = this._app;
            if (!app || this._flatpakHookAdded) return;

            try {
                const appId = app.get_id() || "";
                const appName = app.get_name() || "Unknown App";
                const appInfo = app.get_app_info();
                const filePath = appInfo ? appInfo.get_filename() : '';
                const commandLine = appInfo ? appInfo.get_commandline() : '';

                // DETECTION LOGIC
                const isFlatpak = filePath.includes('/flatpak/') || appId.toLowerCase().includes('flatpak');
                
                // APPIMAGE DETECTION: 
                // Checks if the command points to your ~/.appimage folder
                const isAppImage = commandLine.includes('/.appimage/') || filePath.includes('/.appimage/');

                if (isFlatpak || isAppImage) {
                    this.addMenuItem(new PopupSeparatorMenuItem());

                    let item = new PopupMenuItem('Uninstall');
                    item.label.style = 'color: #ff5555; font-weight: bold;';
                    
                    item.connect('activate', () => {
                        this.close();
                        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                            if (isFlatpak) {
                                extension._uninstallFlatpak(appId.replace('.desktop', ''), appName);
                            } else if (isAppImage) {
                                extension._uninstallAppImage(appInfo, appName);
                            }
                            return GLib.SOURCE_REMOVE;
                        });
                    });

                    this.addMenuItem(item);
                    this._flatpakHookAdded = true;
                }
            } catch (e) { }
        };
    }

    _uninstallFlatpak(appId, appName) {
        Main.notify('Uninstalling...', `Removing Flatpak: ${appName}`);
        let launcher = new Gio.SubprocessLauncher({ flags: Gio.SubprocessFlags.NONE });
        launcher.spawnv(['flatpak', 'uninstall', '-y', appId]);
        this._notifyComplete(appName);
    }

    _uninstallAppImage(appInfo, appName) {
        try {
            Main.notify('Uninstalling...', `Removing AppImage: ${appName}`);

            // 1. Find the AppImage file path from the desktop entry
            const cmd = appInfo.get_commandline(); 
            // Matches the path inside quotes or the first word
            const match = cmd.match(/"([^"]+)"|([^\s]+)/);
            const appImagePath = match ? (match[1] || match[2]) : null;

            // 2. Delete the .AppImage file
            if (appImagePath && appImagePath.includes('.appimage')) {
                let binaryFile = Gio.File.new_for_path(appImagePath);
                binaryFile.delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }

            // 3. Delete the .desktop launcher file
            const desktopPath = appInfo.get_filename();
            if (desktopPath) {
                let desktopFile = Gio.File.new_for_path(desktopPath);
                desktopFile.delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }

            this._notifyComplete(appName);
        } catch (e) {
            console.error(`AppImage Removal Error: ${e}`);
        }
    }

    _notifyComplete(appName) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            Main.notify('Success', `${appName} has been removed.`);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        if (this._originalOpen) PopupMenu.prototype.open = this._originalOpen;
    }
}
