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
            extension._originalOpen.call(this, animate);
            const app = this._app;
            if (!app || this._flatpakHookAdded) return;

            try {
                const appId = app.get_id() || "";
                const appName = app.get_name() || "Unknown App";
                const appInfo = app.get_app_info();
                const filePath = appInfo ? appInfo.get_filename() : '';
                const commandLine = appInfo ? appInfo.get_commandline() : '';
                const customPath = extension._settings.get_string('appimage-path');

                const isFlatpak = filePath.includes('/flatpak/') || appId.toLowerCase().includes('flatpak');
                const isAppImage = (customPath && customPath.length > 1) && 
                                   (commandLine.includes(customPath) || filePath.includes(customPath));

                if (isFlatpak || isAppImage) {
                    this.addMenuItem(new PopupSeparatorMenuItem());
                    let item = new PopupMenuItem('Uninstall');
                    item.label.style = 'color: #ff5555; font-weight: bold;';
                    
                    item.connect('activate', () => {
                        this.close();
                        extension._showConfirmDialog(appName, () => {
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
            } catch (e) { }
        };
    }

    _showConfirmDialog(appName, onConfirm) {
        let dialog = new ModalDialog.ModalDialog();
        
        dialog.setButtons([
            {
                label: 'No',
                action: () => dialog.close(),
                key: Clutter.KEY_Escape,
                isDefault: true // Focus stays on 'No' for safety
            },
            {
                label: 'Yes',
                action: () => {
                    onConfirm();
                    dialog.close();
                },
                key: Clutter.KEY_Return,
                style_class: 'destructive-action' // Keeps the red highlight for the uninstallation action
            }
        ]);

        let box = new St.BoxLayout({
            vertical: true,
            style: 'padding: 30px; spacing: 15px; width: 320px;'
        });

        let title = new St.Label({
            text: `Uninstall ${appName}?`,
            style: 'font-weight: bold; font-size: 14pt; text-align: center;'
        });

        let body = new St.Label({
            text: "This application's functionality will no longer be available. Are you sure you want to uninstall?",
            style: 'text-align: center; font-size: 11pt;'
        });
        body.clutter_text.line_wrap = true;

        box.add_child(title);
        box.add_child(body);
        
        dialog.contentLayout.add_child(box);
        dialog.open();
    }

    _uninstallFlatpak(appId, appName) {
        Main.notify('Uninstalling...', `Removing ${appName}`);
        let launcher = new Gio.SubprocessLauncher({ flags: Gio.SubprocessFlags.NONE });
        launcher.spawnv(['flatpak', 'uninstall', '-y', appId]);
        this._notifyComplete(appName);
    }

    _uninstallAppImage(appInfo, appName) {
        try {
            Main.notify('Uninstalling...', `Removing AppImage: ${appName}`);
            const cmd = appInfo.get_commandline(); 
            const match = cmd.match(/"([^"]+)"|([^\s]+)/);
            const appImagePath = match ? (match[1] || match[2]) : null;

            if (appImagePath && appImagePath.toLowerCase().includes('.appimage')) {
                Gio.File.new_for_path(appImagePath).delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }
            const desktopPath = appInfo.get_filename();
            if (desktopPath) {
                Gio.File.new_for_path(desktopPath).delete_async(GLib.PRIORITY_DEFAULT, null, null);
            }
            this._notifyComplete(appName);
        } catch (e) { }
    }

    _notifyComplete(appName) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            Main.notify('Success', `${appName} removed.`);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        if (this._originalOpen) PopupMenu.prototype.open = this._originalOpen;
        this._settings = null;
    }
}
