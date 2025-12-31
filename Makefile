UUID = right-click-uninstall@user.local
FILES = extension.js prefs.js metadata.json schemas/

all: compile
	@echo "Packaging extension..."
	zip -r $(UUID).shell-extension.zip $(FILES) -x "*.DS_Store"

compile:
	@echo "Compiling schemas..."
	glib-compile-schemas schemas/

install: all
	@echo "Installing to local extensions directory..."
	mkdir -p ~/.local/share/gnome-shell/extensions/$(UUID)
	cp -r * ~/.local/share/gnome-shell/extensions/$(UUID)/
