#!/bin/bash

UUID="right-click-uninstall@user.local"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Right-Click Uninstall..."

# 1. Create directory
mkdir -p "$DEST"

# 2. Copy all files
cp -r ./* "$DEST/"

# 3. Compile schemas in the destination
glib-compile-schemas "$DEST/schemas/"

echo "--------------------------------------------------"
echo "Done! Please restart GNOME Shell (Log out/in)."
echo "Then enable the extension in the 'Extensions' app."
echo "--------------------------------------------------"
