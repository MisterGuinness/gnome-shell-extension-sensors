# extensiondir declared in configure.ac
dist_extension_DATA = extension.js prefs.js utilities.js subproc.js dbus.js
dist_extension_SCRIPTS = mrg_sensors.sh

# I don't want the bash script world-executable, and the below sets up the local script
# with user and group executable only, but when it is actually installed, it is as if
# it gets chmod +x and becomes other-executable too.
.PHONY: mrg_sensors.sh
mrg_sensors.sh:
	chmod ug+x mrg_sensors.sh
