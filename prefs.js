import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

export default class FlatnukePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ 
            title: 'AppImage Settings',
            description: 'Choose the directory where your AppImages are stored.' 
        });
        
        // Use an ActionRow to display the current path and a button
        const row = new Adw.ActionRow({
            title: 'Path to AppImages',
            subtitle: settings.get_string('appimage-path')
        });

        const browseButton = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            valign: Gtk.Align.CENTER,
            margin_start: 10
        });

        // Setup the FileDialog
        const dialog = new Gtk.FileDialog({
            title: 'Select AppImage Folder',
            initial_folder: Gio.File.new_for_path(GLib.get_home_dir())
        });

        browseButton.connect('clicked', () => {
            dialog.select_folder(window, null, (source, result) => {
                try {
                    const folder = dialog.select_folder_finish(result);
                    if (folder) {
                        const path = folder.get_path();
                        // Update the setting
                        settings.set_string('appimage-path', path);
                        // Update the UI subtitle to show the new path
                        row.set_subtitle(path);
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        });

        row.add_suffix(browseButton);
        group.add(row);
        page.add(group);
        window.add(page);
    }
}
