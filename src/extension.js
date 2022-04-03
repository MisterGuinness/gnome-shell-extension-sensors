const St = imports.gi.St;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Shell = imports.gi.Shell;
const Utilities = Me.imports.utilities;

const Gettext = imports.gettext;
const Domain = Gettext.domain(Me.metadata['gettext-domain']);
const _ = Domain.gettext;

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray

let metadata = Me.metadata;
let extensionPath;

const SensorsItem = new Lang.Class({
    Name: 'SensorsItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(type, label, value) {
        this.parent();
        this._settings = ExtensionUtils.getSettings();
        this._label = label;
        this._value = value;

        let sensorIcon = Gio.icon_new_for_string(extensionPath + '/icons/hicolor/scalable/status/sensors-'+type+'-symbolic.svg');
        this.add(new St.Icon({gicon: sensorIcon, style_class: 'popup-menu-icon'}));
        this.add(new St.Label({text: label}));
        this.add(new St.Label({text: value, x_expand: true, x_align: Clutter.ActorAlign.END}));
    },

    getPanelString: function() {
        if(this._settings.get_boolean('display-label'))
            return '%s: %s'.format(this._label, this._value);
        else
            return this._value;
    },

    setMainSensor: function() {
        this.setOrnament(PopupMenu.Ornament.DOT);
    },

    getLabel: function() {
        return this._label;
    },
});

const SensorsMenuButton = new Lang.Class({
    Name: 'SensorsMenuButton',

    Extends: PanelMenu.Button,

    _init: function(){
        this.parent(null, 'sensorMenu');

        this._settings = ExtensionUtils.getSettings();
        this._sensorsOutput = '';
        this._hddtempOutput = '';

        this.statusLabel = new St.Label({ text: '\u2026', y_expand: true, y_align: Clutter.ActorAlign.CENTER });

        this.menu.removeAll();
        this.add_actor(this.statusLabel);

        this.sensorsArgv = Utilities.detectSensors();

        if (this._settings.get_boolean('display-hdd-temp')){
            this.hddtempArgv = Utilities.detectHDDTemp();
        }

        this.udisksProxies = [];
        Utilities.UDisks.get_drive_ata_proxies(Lang.bind(this, function(proxies) {
            this.udisksProxies = proxies;
            this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
        }));

        this._settingsChanged = this._settings.connect('changed', Lang.bind(this, this._querySensors));
        this.connect('destroy', Lang.bind(this, this._onDestroy));

        // don't postprone the first call by update-time.
        this._querySensors();

        this._eventLoop = Mainloop.timeout_add_seconds(this._settings.get_int('update-time'), Lang.bind(this, function (){
            this._querySensors();
            // readd to update queue
            return true;
        }));
    },

    _onDestroy: function(){
        Mainloop.source_remove(this._eventLoop);
        this.menu.removeAll();
        this._settings.disconnect(this._settingsChanged);
    },

    _querySensors: function(){
        if (this.sensorsArgv){
            this._sensorsFuture = new Utilities.Future(this.sensorsArgv, Lang.bind(this,function(stdout){
                this._sensorsOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
                this._sensorsFuture = undefined;
            }));
        }

        if (this.hddtempArgv){
            this._hddtempFuture = new Utilities.Future(this.hddtempArgv, Lang.bind(this,function(stdout){
                this._hddtempOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
                this._hddtempFuture = undefined;
            }));
        }
    },

    _updateDisplay: function(sensors_output, hddtemp_output){
        let display_fan_rpm = this._settings.get_boolean('display-fan-rpm');
        let display_voltage = this._settings.get_boolean('display-voltage');

        let tempInfo = Array();
        let fanInfo = Array();
        let voltageInfo = Array();

        const oldLocale = Utilities.overrideLocale();

        tempInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseSensorsTemperatureLine);
        if (display_fan_rpm){
            fanInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseFanRPMLine);
        }
        if (display_voltage){
            voltageInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseVoltageLine);
        }

        if(this.hddtempArgv)
            tempInfo = tempInfo.concat(Utilities.parseHddTempOutput(hddtemp_output, !(/nc$/.exec(this.hddtempArgv[0])) ? ': ' : '|'));

        tempInfo = tempInfo.concat(Utilities.UDisks.create_list_from_proxies(this.udisksProxies));

        tempInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });
        fanInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });
        voltageInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });

        this.menu.removeAll();
        let section = new PopupMenu.PopupMenuSection("Temperature");
        if (this.sensorsArgv && tempInfo.length > 0){
            let sensorsList = new Array();
            let sum = 0; //sum
            let max = 0; //max temp
            for (const temp of tempInfo){
                sum += temp['temp'];
                if (temp['temp'] > max)
                    max = temp['temp'];

                sensorsList.push(new SensorsItem('temperature', temp['label'], this._formatTemp(temp['temp'])));
            }
            if (tempInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());

                // Add average and maximum entries
                sensorsList.push(new SensorsItem('temperature', _("Average"), this._formatTemp(sum/tempInfo.length)));
                sensorsList.push(new SensorsItem('temperature', _("Maximum"), this._formatTemp(max)));

                if(fanInfo.length > 0 || voltageInfo.length > 0)
                    sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }

            for (const fan of fanInfo){
                sensorsList.push(new SensorsItem('fan', fan['label'], _("%drpm").format(fan['rpm'])));
            }
            if (fanInfo.length > 0 && voltageInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }
            for (const voltage of voltageInfo){
                sensorsList.push(new SensorsItem('voltage', voltage['label'], _("%s%.2f%s").format(((voltage['volt'] >= 0) ? '+' : '-'), voltage['volt'], voltage['unit'])));
            }

            this.statusLabel.set_text(_("N/A")); // Just in case

            for (const item of sensorsList) {
                if(item instanceof SensorsItem) {
                    if (this._settings.get_string('main-sensor') == item.getLabel()) {

                        // Configure as main sensor and set panel string
                        item.setMainSensor();
                        this.statusLabel.set_text(item.getPanelString());
                    }
                    item.connect('activate', Lang.bind(this, function () {
                        this._settings.set_string('main-sensor', item.getLabel());
                    }));
                }
                section.addMenuItem(item);
            }

            // separator
            section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let item = new PopupMenu.PopupBaseMenuItem();
            // HACK: span and expand parameters don't work as expected on Label, so add an invisible
            // Label to switch columns and not totally break the layout.
            item.actor.add(new St.Label({ text: '' }));
            item.actor.add(new St.Label({ text: _("Sensors Settings") }));
            item.connect('activate', Lang.bind(this, function () {
                imports.misc.extensionUtils.openPrefs();
            }));
            section.addMenuItem(item);

            // time of update
            let time = new PopupMenu.PopupBaseMenuItem();
            time.actor.add(new St.Label({ text: '' }));
            /* TRANSLATORS: the placeholder is locale specific time that sensor
               values were last displayed in the menu */
            time.actor.add(new St.Label({ text: _("Last Updated %s").format( new Date().toLocaleTimeString() ) }));
            section.addMenuItem(time);
        }else{
            this.statusLabel.set_text(_("Error"));

            let item = new PopupMenu.PopupMenuItem(
                (this.sensorsArgv
                    ? _("Please run sensors-detect as root.")
                    : _("Please install lm_sensors.")) + "\n" + _("If this doesn\'t help, click here to report with your sensors output!")
            );
            item.connect('activate',function() {
                Util.spawn(["xdg-open", "http://github.com/xtranophilist/gnome-shell-extension-sensors/issues/"]);
            });
            section.addMenuItem(item);
        }

        this.menu.addMenuItem(section);

        Utilities.restoreLocale(oldLocale);
    },

    _toFahrenheit: function(c){
        return ((9/5)*c+32);
    },

    _formatTemp: function(value) {
        if (this._settings.get_string('unit')=='Fahrenheit'){
            value = this._toFahrenheit(value);
        }
        let format = '%.1f';
        if (!this._settings.get_boolean('display-decimal-value')){
            //ret = Math.round(value);
            format = '%d';
        }
        if (this._settings.get_boolean('display-degree-sign')) {
            format += '%s';
        }
        return format.format(value, (this._settings.get_string('unit')=='Fahrenheit') ? "\u00b0F" : "\u00b0C");
    }
});

let sensorsMenu;

function init(extensionMeta) {
    ExtensionUtils.initTranslations();
    extensionPath = extensionMeta.path;
}

function enable() {
    sensorsMenu = new SensorsMenuButton();
    Main.panel.addToStatusArea('sensorsMenu', sensorsMenu, 1, 'right');
}

function disable() {
    sensorsMenu.destroy();
    sensorsMenu = null;
}
