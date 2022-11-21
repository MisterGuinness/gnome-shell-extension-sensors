# extensiondir declared in configure.ac
extension_DATA = metadata.json
EXTRA_DIST = metadata.json.in

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(localedir)|" \
	    -e "s|[@]GETTEXT_PACKAGE@|$(GETTEXT_PACKAGE)|" \
	    -e "s|[@]uuid@|$(uuid)|" \
	    -e "s|[@]url@|$(PACKAGE_BUGREPORT)|" $< > $@

CLEANFILES = metadata.json

# icondir declared in configure.ac
dist_icon_DATA = \
	sensors-fan-symbolic.svg \
	sensors-temperature-symbolic.svg \
	sensors-voltage-symbolic.svg

gsettings_SCHEMAS = org.gnome.shell.extensions.sensors.gschema.xml

@GSETTINGS_RULES@

EXTRA_DIST += $(gsettings_SCHEMAS)
