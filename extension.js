import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {PopupMenu, PopupMenuItem, PopupSeparatorMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export default class FlatpakUninstallExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._originalOpen = PopupMenu.prototype.open;
        const extension = this;

        PopupMenu.prototype.open = function(animate) {
            // Call original GNOME open method
            extension._originalOpen.call(this, animate);

            // Access the app object from the menu (discovered in our logs)
            const app = this._app;
            if (!app || this._flatpakHookAdded) return;

            try {
                const appId = app.get_id() || "";
                const appName = app.get_name() || "Unknown App";
                const appInfo = app.get_app_info();
                const filePath = appInfo ? appInfo.get_filename() : '';
                const commandLine = appInfo ? appInfo.get_commandline() : '';

                // Get the custom path from GSettings
                const customPath = extension._settings.get_string('appimage-path');

                // Detection Logic
                const isFlatpak = filePath.includes('/flatpak/') || appId.toLowerCase().includes('flatpak');
                
                // Check if the custom path exists in the executable command or the desktop file location
                const isAppImage = (customPath && customPath.length > 1) && 
                                   (commandLine.includes(customPath) || filePath.includes(customPath));

                if (isFlatpak || isAppImage) {
                    this.addMenuItem(new PopupSeparatorMenuItem());

                    let item = new PopupMenuItem('Uninstall');
                    item.label.style = 'color: #ff5555; font-weight: bold;';
                    
                    item.connect('activate', () => {
                        this.close();
                        extension._showConfirmDialog(appName, () => {
                            // Defer execution to the next idle cycle for stability
                            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                                if (isFlatpak) {
                                    extension._uninstallFlatpak(appId.replace('.desktop', ''), appName);
                                } else if (isAppImage) {
                                    extension._uninstallAppImage(appInfo, appName);
                                }
                                return GLib.SOURCE_REMOVE;
                            });
                        });
                    });

                    this.addMenuItem(item);
                    this._flatpakHookAdded = true;
                }
            } catch (e) {
                console.error(`Flatpak/AppImage Uninstall Error: ${e}`);
            }
        };
    }

    _showConfirmDialog(appName, onConfirm) {
        let dialog = new ModalDialog.ModalDialog();
        
        dialog.setButtons([
            {
                label: 'Cancel',
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
                isDefault: true
            },
            {
                label: 'Delete',
                action: () => {
                    onConfirm();
                    dialog.close();
                },
                key: Clutter.KEY_Return,
                default: false
            }
        ]);

        let label = new St.Label({
            text: `Delete ${appName}?`,
            style: 'font-size: 14pt; font-weight: bold; padding: 30px; text-align: center;'
        });

        dialog.contentLayout.add_child(label);
        dialog.open();
    }

    _uninstallFlatpak(appId, appName) {
        Main.notify('Uninstalling...', `Removing Flatpak: ${appName}`);
        let launcher = new Gio.SubprocessLauncher({ flags: Gio.SubprocessFlags.NONE });
        try {
            launcher.spawnv(['flatpak', 'uninstall', '-y', appId]);
            this._notifyComplete(appName);
        } catch (e) {
            Main.notify('Error', `Failed to uninstall ${appName}`);
        }
    }

    _uninstallAppImage(appInfo, appName) {
        try {
            Main.notify('Uninstalling...', `Removing AppImage: ${appName}`);
            
            const cmd = appInfo.get_commandline(); 
            const match = cmd.match(/"([^"]+)"|([^\s]+)/);
            const appImagePath = match ? (match[1] || match[2]) : null;

            // Delete binary
            if (appImagePath && (appImagePath.toLowerCase().includes('.appimage') || appImagePath.toLowerCase().includes('.run'))) {
                Gio.File.new_for_path(appImagePath).delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }
            
            // Delete desktop entry
            const desktopPath = appInfo.get_filename();
            if (desktopPath) {
                Gio.File.new_for_path(desktopPath).delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }
            
            this._notifyComplete(appName);
        } catch (e) {
            console.error(`AppImage Removal Error: ${e}`);
        }
    }

    _notifyComplete(appName) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            Main.notify('Success', `${appName} removed.`);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        if (this._originalOpen) {
            PopupMenu.prototype.open = this._originalOpen;
        }
        this._settings = null;
    }
}
