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
        
        const row = new Adw.ActionRow({
            title: 'Path to AppImages',
            subtitle: settings.get_string('appimage-path')
        });

        // 1. Browse Button
        const browseButton = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            tooltip_text: 'Browse for folder',
            valign: Gtk.Align.CENTER,
            margin_start: 5
        });

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
                        settings.set_string('appimage-path', path);
                        row.set_subtitle(path);
                    }
                } catch (e) { console.error(e); }
            });
        });

        // 2. Reset Button
        const resetButton = new Gtk.Button({
            icon_name: 'edit-clear-all-symbolic', // Or 'view-refresh-symbolic'
            tooltip_text: 'Reset to default (~/.appimage/)',
            valign: Gtk.Align.CENTER,
            margin_start: 5
        });

        resetButton.connect('clicked', () => {
            // This pulls the default value from your .gschema.xml
            settings.reset('appimage-path');
            // Update the UI subtitle to show the new (default) path
            row.set_subtitle(settings.get_string('appimage-path'));
        });

        // Add both buttons to the end of the row
        row.add_suffix(browseButton);
        row.add_suffix(resetButton);
        
        group.add(row);
        page.add(group);
        window.add(page);
    }
}
