This extension is being updated against my Fedora distribution, typically for each odd numbered release, for my own use. Of course you are welcome to **manually** install it using the **Manual Installation** instructions below.

Currently supporting **Fedora 33 and 34**.

gnome-shell-extension-sensors
=============================
*gnome-shell-extension-sensors* (previously known as gnome-shell-extension-cpu-temperature)
is an extension for displaying CPU temperature, hard disk temperature, voltage and
CPU fan RPM in GNOME Shell.

The extension uses [sensors] from lm_sensors package (lm-sensors for Debian systems)
to read temperature for different CPU cores and adapters, voltage data and fan speed.

Optionally, this extension uses the [UDisks2] dbus interface or [hddtemp] as fallback to
read hard drive temperature data.

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
* *gnome-common*,
* *autoconf*,
* *automake*,
* *intltool*.

From stock Fedora, the following installs are necessary to cover the build dependencies:

    sudo dnf install gnome-common

Installed:
  autoconf-2.69-34.fc33.noarch              autoconf-archive-2019.01.06-6.fc33.noarch  automake-1.16.2-2.fc33.noarch    gnome-common-3.18.0-10.fc33.noarch      itstool-2.0.6-4.fc33.noarch         
  libtool-2.4.6-36.fc33.x86_64              m4-1.4.18-15.fc33.x86_64                   mallard-rng-1.1.0-4.fc33.noarch  perl-Thread-Queue-3.14-457.fc33.noarch  perl-threads-1:2.25-457.fc33.x86_64 
  perl-threads-shared-1.61-457.fc33.x86_64  yelp-tools-3.38.0-1.fc33.noarch

    sudo dnf install intltool

Installed:
  ed-1.14.2-9.fc33.x86_64             gettext-common-devel-0.21-3.fc33.noarch  gettext-devel-0.21-3.fc33.x86_64  info-6.7-8.fc33.x86_64  intltool-0.51.0-17.fc33.noarch  patch-2.7.6-13.fc33.x86_64 
  perl-XML-Parser-2.46-6.fc33.x86_64

    sudo dnf install glib2-devel

Installed:
  glib2-devel-2.66.2-1.fc33.x86_64      libblkid-devel-2.36-3.fc33.x86_64      libffi-devel-3.1-26.fc33.x86_64      libmount-devel-2.36-3.fc33.x86_64      libselinux-devel-3.1-2.fc33.x86_64     
  libsepol-devel-3.1-3.fc33.x86_64      pcre-cpp-8.44-1.fc33.1.x86_64          pcre-devel-8.44-1.fc33.1.x86_64      pcre-utf16-8.44-1.fc33.1.x86_64        pcre-utf32-8.44-1.fc33.1.x86_64        
  pcre2-devel-10.35-7.fc33.x86_64       zlib-devel-1.2.11-22.fc33.x86_64

    sudo dnf install make

Installed:
  make-1:4.3-2.fc33.x86_64

Then run autogen:

    ./autogen.sh

You can install this extension for your user by executing:

    make local-install

or system wide by executing (this requires root permissions):

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

