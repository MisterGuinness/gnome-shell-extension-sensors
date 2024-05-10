gnome-shell-extension-sensors
=============================
*gnome-shell-extension-sensors* (previously known as gnome-shell-extension-cpu-temperature)
is an extension for displaying CPU temperature, hard disk temperature, voltage
and CPU fan RPM in GNOME Shell.

The extension uses [sensors] from lm_sensors package (lm-sensors for Debian
systems) to read temperature for different CPU cores and adapters, voltage data
and fan speed.

Optionally, this extension uses the [UDisks2] dbus interface or [hddtemp] as
fallback to read hard drive temperature data.

This extension is being updated against my Fedora distribution. Of course you
are welcome to **manually** install it using the **Manual Installation** instructions below.

Version Support Matrix
---
I mention Fedora here because that is what I use, for other distributions just
match the Gnome Shell version.

Note that supporting Gnome Shell v45 is a breaking change (implementing a
non-backward compatible change to use ESM imports), such that v3.0 of the
extension will not run on Gnome Shell prior to v45, and v2.0 and earlier versions
of the extension will not run on Gnome Shell after v44.

|Extension Version|Fedora|Gnome Shell|Note|
|---|---|---|---|
|3.1 (current)|40|46|
| |39|45|
|3.0|39|45|
|2.0|38|44|Not supported on Fedora >=39 or Gnome Shell >=45|
|2.0|37|43|
|2.0|36|42|
|2.0|35|41|
|2.0|34|40|
|2.0|33|3.38|
|1.3|32|3.36|
|1.3|31|3.34|
|1.3|30|3.32|

![screenshot]

Installation
=============

Installation by GNOME extensions
-------------------------------

This is the **very old method** for installation, as it doesn't require the build
dependencies for installation.
You can install this extension by visiting the [GNOME extensions]
page for this extension.

Installation by package manager
-------------------------------

Fedora has packaged a **very old** version of this extension. You can install it by running:

`yum -y install gnome-shell-extension-cpu-temperature`

However this package will be retired and possibly replaced in the future according to Bug [RH#983409].

Manual installation
-------------------

To install this extension you need to clone the source and build the extension.

For gnome-shell 3.10 or newer please run the following commands:

    cd ~ && git clone https://github.com/MisterGuinness/gnome-shell-extension-sensors.git
    cd ~/gnome-shell-extension-sensors

For gnome-shell 3.8 or older please run the following commands:

    cd ~ && git clone https://github.com/MisterGuinness/gnome-shell-extension-sensors.git
    cd ~/gnome-shell-extension-sensors
    git checkout gnome-3.8

The build dependenciesare:

* *gettext*,
* *pkg-config*,
* *git*,
* *glib2*,
* *glib2-devel* or *libglib2.0-dev*,
* *zip*,
* *autoconf*,
* *automake*,
* *gettext-devel*
* *gcc*

From stock Fedora, the following installs are necessary to cover the build dependencies:

    sudo dnf install gcc autoconf automake glib2-devel make gettext-devel

Then configure for a local installation (for your user):

    ./autogen.sh

Build any generated files (eg updated translations):

    make

You can install this extension by executing:

    make install

After installation you need to restart the GNOME shell:

* `ALT`+`F2` to open the command prompt
* Enter `r` to restart the GNOME shell

For Wayland users, simply logout and back in.

Install lm-sensors (refer below), then enable the extension:

For Fedora 34 (Gnome-shell 40) and later, install the Gnome Extensions app

    sudo dnf install gnome-extensions-app

Run the app and turn on the 'Sensors' slider. Click the gear icon to open the sensors settings page or use the 'Sensors Setting' item at the bottom of the sensor menu.

For Fedora 33 and earlier, install Gnome Tweaks (previously Gnome Tweak Tool)

    sudo dnf install gnome-tweak-tool

Open `Tweaks` -> `Extensions` -> `Sensors` -> On


Installing lm-sensors and (optionally) hdd-temp
-------------
This extensions uses the output of `sensors`(1) command to obtain the
temperature data and sensor labeling. 

Installing lm-sensors for Fedora, CentOS and other distros with dnf:

    sudo dnf install lm_sensors

Ubuntu, Debian and other distros with apt-get:

    apt-get install lm-sensors

Then run the one time detection process:

    sudo sensors-detect

Installing `hdd-temp` is optional, and only required if you find lm-sensors doesn't include drive temps:

    sudo dnf install hddtemp


Configuration
---------------------

This extensions uses the output of `sensors`(1) command to obtain the
temperature data and sensor labeling. To relabel, hide or correct the
output consult the `sensors.conf`(5) manual.

Authors : [authors]

[sensors]: http://www.lm-sensors.org/
[UDisks2]: http://www.freedesktop.org/wiki/Software/udisks/
[hddtemp]: https://savannah.nongnu.org/projects/hddtemp/
[GNOME extensions]: https://extensions.gnome.org/extension/82/cpu-temperature-indicator/
[authors]: https://github.com/xtranophilist/gnome-shell-extension-sensors/graphs/contributors
[screenshot]: Fedora33.png
[RH#983409]: https://bugzilla.redhat.com/show_bug.cgi?id=983409

