const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const ByteArray = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utilities = Me.imports.utilities;

const Gettext = imports.gettext;
const Domain = Gettext.domain(Me.metadata['gettext-domain']);
const _ = Domain.gettext;

const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

function init() {
    ExtensionUtils.initTranslations();
}

const SensorsPrefsWidget = new GObject.Class({
    Name: 'Sensors.Prefs.Widget',
    GTypeName: 'SensorsPrefsWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);

        const oldLocale = Utilities.overrideLocale();

        this.margin_start = this.margin_end = this.margin_bottom = this.row_spacing = this.column_spacing = 20;

        this._settings = ExtensionUtils.getSettings();

        this.attach(new Gtk.Label({ label: _("Poll sensors every (in seconds)"), halign: Gtk.Align.END }), 0, 0, 1, 1);
        let update_time = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 5, 100, 5);
        update_time.set_value(this._settings.get_int('update-time'));
        update_time.set_digits(0);
        update_time.set_hexpand(true);
        update_time.connect('value-changed', this._onUpdateTimeChanged.bind(this));
        update_time.set_draw_value(true);
        this.attach(update_time, 1, 0, 1, 1);

        this.attach(new Gtk.Label({ label: _("Temperature unit"), halign: Gtk.Align.END }), 0, 2, 1, 1);

        let centigradeRadio = null;
        let fahrenheitRadio = null;

        if (shellVersion < 40) {
            //Shell 3.38 or lower
            centigradeRadio = new Gtk.RadioButton({ group: null, label: _("Centigrade"), valign: Gtk.Align.START });
            fahrenheitRadio = new Gtk.RadioButton({ group: centigradeRadio, label: _("Fahrenheit"), valign: Gtk.Align.START });
        }
        else {
            //Shell 40 or higher
            centigradeRadio = new Gtk.CheckButton({ label: _("Centigrade") });
            fahrenheitRadio = new Gtk.CheckButton({ group: centigradeRadio, label: _("Fahrenheit") });
        }

        fahrenheitRadio.connect('toggled', this._onUnitChanged.bind(this, 'Fahrenheit'));
        centigradeRadio.connect('toggled', this._onUnitChanged.bind(this, 'Centigrade'));

        if (this._settings.get_string('unit')=='Centigrade')
            centigradeRadio.active = true;
        else
            fahrenheitRadio.active = true;
        this.attach(centigradeRadio, 1, 2, 1, 1);
        this.attach(fahrenheitRadio, 2, 2, 1, 1);

        let boolSettings = {
            display_degree_sign: {
                name: "display-degree-sign",
                label: _("Display temperature unit"),
                help: _("Show temperature unit in panel and menu.")
            },
            display_decimal_value: {
                name: "display-decimal-value",
                label: _("Display decimal value"),
                help: _("Show one digit after decimal.")
           },
           show_hdd_temp: {
                name: "display-hdd-temp",
                label: _("Display drive temperature"),
           },
           show_fan_rpm: {
                name: "display-fan-rpm",
                label: _("Display fan speed"),
           },
           show_voltage: {
                name: "display-voltage",
                label: _("Display power supply voltage"),
           },
        }

        let counter = 3;

        for (let boolSetting in boolSettings){
            let setting = boolSettings[boolSetting];
            let settingLabel = new Gtk.Label({ label: setting.label, halign: Gtk.Align.END });
            let settingSwitch = new Gtk.Switch({ active: this._settings.get_boolean(setting.name), halign: Gtk.Align.START });
            let settings = this._settings;
            settingSwitch.connect('notify::active', function(button) {
                settings.set_boolean(setting.name, button.active);
            });

            if (setting.help) {
               settingLabel.set_tooltip_text(setting.help);
               settingSwitch.set_tooltip_text(setting.help);
            }

            this.attach(settingLabel, 0, counter, 1, 1);
            this.attach(settingSwitch, 1, counter++, 1, 1);

        }

        // List of sensor labels
        this._sensorList = new Gtk.StringList();
        this._sensorList.append(_("Average"));
        this._sensorList.append(_("Maximum"));

        //Get current options
        this._display_fan_rpm = this._settings.get_boolean('display-fan-rpm');
        this._display_voltage = this._settings.get_boolean('display-voltage');
        this._display_hdd_temp = this._settings.get_boolean('display-hdd-temp');

        //Fill the list
        this._getSensorsLabels();
        this._getUdisksLabels();

        if(this._display_hdd_temp) {
            this._getHddTempLabels();
        }

        // select which sensor to show in panel
        this._sensorSelector = Gtk.DropDown.new( this._sensorList, null );
        this._sensorSelector.set_selected(this._findActiveSensor());
        this._sensorSelector.connect('notify::selected-item', this._onSelectorChanged.bind(this));

        this.attach(new Gtk.Label({ label: _("Sensor in panel"), halign: Gtk.Align.END }), 0, ++counter, 1, 1);
        this.attach(this._sensorSelector, 1, counter , 1, 1);

        let settings = this._settings;
        let checkButton = new Gtk.CheckButton({label: _("Display sensor label")});
        checkButton.set_active(settings.get_boolean('display-label'));
        checkButton.connect('toggled', function () {
            settings.set_boolean('display-label', checkButton.get_active());
        });
        this.attach(checkButton, 2, counter , 1, 1);

        Utilities.restoreLocale(oldLocale);
    },

    _appendMultipleItems: function(sensorInfo) {
        for (const sensor of sensorInfo) {
            this._sensorList.append(sensor['label']);
        }
    },

    _getSensorsLabels: function() {
        let sensors_cmd = Utilities.detectSensors();
        if(sensors_cmd) {
            let [result, sensors_output] = GLib.spawn_command_line_sync(sensors_cmd.join(' '));
            if(result)
            {
                let output = ByteArray.toString(sensors_output);
                let tempInfo = Utilities.parseSensorsOutput(output,Utilities.parseSensorsTemperatureLine);
                this._appendMultipleItems(tempInfo);

                if (this._display_fan_rpm){
                    let fanInfo = Utilities.parseSensorsOutput(output,Utilities.parseFanRPMLine);
                    this._appendMultipleItems(fanInfo);
                }
                if (this._display_voltage){
                    let voltageInfo = Utilities.parseSensorsOutput(output,Utilities.parseVoltageLine);
                    this._appendMultipleItems(voltageInfo);
                }
            }
        }
    },

    _getHddTempLabels: function() {
        let hddtemp_cmd = Utilities.detectHDDTemp();
        if(hddtemp_cmd){
            let [result, hddtemp_output] = GLib.spawn_command_line_sync(hddtemp_cmd.join(' '))
            if(result){
                let hddTempInfo = Utilities.parseHddTempOutput(ByteArray.toString(hddtemp_output),
                                        !(/nc$/.exec(hddtemp_cmd[0])) ? ': ' : '|');
                this._appendMultipleItems(hddTempInfo);
            }
        }
    },

    _getUdisksLabels: function() {
        Utilities.UDisks.get_drive_ata_proxies((function(proxies) {
            let list = Utilities.UDisks.create_list_from_proxies(proxies);

            this._appendMultipleItems(list);
        }).bind(this));
    },

    _findActiveSensor: function() {
        let activeSensor = this._settings.get_string('main-sensor');

        let position = 0;
        let label = this._sensorSelector.get_model().get_string(position);
        let found = false;

        while (label && !found) {
            if (label == activeSensor) {
                found = true;
            }
            else {
                label = this._sensorSelector.get_model().get_string(++position);
            }
        }

        if (!found) {
            // default to first item in list
            position = 0;
        }

        return position;
    },

    _onUpdateTimeChanged: function (update_time) {
        this._settings.set_int('update-time', update_time.get_value());
    },

    _onUnitChanged: function (unit, button) {
        if (button.get_active()) {
            this._settings.set_string('unit', unit);
        }
    },

    _onSelectorChanged: function (selector) {
        let position = selector.get_selected();
        let label = selector.get_model().get_string(position);
        this._settings.set_string('main-sensor', label);
    }

});

function buildPrefsWidget() {
    let widget = new SensorsPrefsWidget();
    if (shellVersion < 40) {
        //Shell 3.38 or lower
        widget.show_all();
    }
    return widget;
}
