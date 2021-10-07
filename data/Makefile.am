extensionurl = @PACKAGE_BUGREPORT@

# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions

uuid = "@uuid@"

extensiondir = $(topextensiondir)/$(uuid)

nodist_extension_DATA = metadata.json $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(datadir)/locale|" \
	    -e "s|[@]GETTEXT_PACKAGE@|$(GETTEXT_PACKAGE)|" \
	    -e "s|[@]uuid@|$(uuid)|" \
	    -e "s|[@]url@|$(extensionurl)|" $< > $@

CLEANFILES = metadata.json

icondir = $(datadir)/icons/hicolor/scalable/status

icon_DATA = \
	sensors-fan-symbolic.svg \
	sensors-temperature-symbolic.svg \
	sensors-voltage-symbolic.svg

gsettings_SCHEMAS = org.gnome.shell.extensions.sensors.gschema.xml

@GSETTINGS_RULES@

EXTRA_DIST += $(gsettings_SCHEMAS)
