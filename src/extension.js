const {St, Clutter, Gio, GObject} = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utilities = Me.imports.utilities;

const Gettext = imports.gettext;
const Domain = Gettext.domain(Me.metadata['gettext-domain']);
const _ = Domain.gettext;

const ByteArray = imports.byteArray;

let metadata = Me.metadata;
let extensionPath;

const SensorsItem = GObject.registerClass({
    GTypeName: 'SensorsItem'
    }, class SensorsItem
    extends PopupMenu.PopupBaseMenuItem {

    _init(label, value, icon) {
        super._init();
        this._label = label;
        this._value = value;

        this.add(new St.Icon({gicon: icon, style_class: 'popup-menu-icon'}));
        this.add(new St.Label({text: label}));
        this.add(new St.Label({text: value, x_expand: true, x_align: Clutter.ActorAlign.END}));
    }

    getLabel() {
        return this._label;
    }

    getValue() {
        return this._value;
    }

    configureCurrentSensor( currentSensorLabel ) {
        // is this item the sensor the user wants to display in the panel button
        // according to the label stored in the settings
        if (this._label === currentSensorLabel) {

            // mark the menu item visually
            // to indicate it as the sensor in the panel button
            this.setOrnament(PopupMenu.Ornament.DOT);

            // indicate to caller that this menu item is for the current sensor
            return true;
        }
    }
});

const SensorsMenuButton = GObject.registerClass({
    GTypeName: 'SensorsMenuButton'
    }, class SensorsMenuButton
    extends PanelMenu.Button {

    _init() {
        super._init(null, 'sensorMenu');

        // create icons for menu
        this._iconTemp = Gio.icon_new_for_string(extensionPath + '/icons/hicolor/scalable/status/sensors-temperature-symbolic.svg');
        this._iconFan = Gio.icon_new_for_string(extensionPath + '/icons/hicolor/scalable/status/sensors-fan-symbolic.svg');
        this._iconVolt = Gio.icon_new_for_string(extensionPath + '/icons/hicolor/scalable/status/sensors-voltage-symbolic.svg');

        this._settings = ExtensionUtils.getSettings();
        this._sensorsOutput = '';
        this._hddtempOutput = '';

        this.statusLabel = new St.Label({ text: Me.metadata.name, y_expand: true, y_align: Clutter.ActorAlign.CENTER });

        this.menu.removeAll();
        this.add_actor(this.statusLabel);

        this.sensorsArgv = Utilities.detectSensors();

        if (this._settings.get_boolean('display-hdd-temp')){
            this.hddtempArgv = Utilities.detectHDDTemp();
        }

        this.udisksProxies = [];
        Utilities.UDisks.get_drive_ata_proxies( (proxies) => {
            this.udisksProxies = proxies;
            this._updateDisplay(this._sensorsOutput, this._hddtempOutput, false);
        });

        this._settingsChanged = this._settings.connect('changed', this._querySensors.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        // don't postprone the first call by update-time.
        this._querySensors();

        this._eventLoop = Mainloop.timeout_add_seconds(this._settings.get_int('update-time'), () => {
            this._querySensors();
            // NOTE: return true to continuously fire the timer
            return true;
        });
    }

    _onDestroy() {
        Mainloop.source_remove(this._eventLoop);
        this.menu.removeAll();
        this._settings.disconnect(this._settingsChanged);
    }

    _querySensors() {
        if (this.sensorsArgv){
            this._sensorsFuture = new Utilities.Future(this.sensorsArgv, (stdout, hasError) => {
                this._sensorsOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput, hasError);
                this._sensorsFuture = undefined;
            });
        }

        if (this.hddtempArgv){
            this._hddtempFuture = new Utilities.Future(this.hddtempArgv, (stdout, hasError) => {
                this._hddtempOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput, hasError);
                this._hddtempFuture = undefined;
            });
        }

        return true;
    }

    _updateDisplay(sensors_output, hddtemp_output, hasError) {
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

        if (hasError) {
            let item = new PopupMenu.PopupMenuItem("Please check system log for errors");
            section.addMenuItem(item);
        }

        if (this.sensorsArgv && tempInfo.length > 0){
            let sensorsList = new Array();
            let currentSensor = this._settings.get_string('main-sensor');
            let displayLabelInPanel = this._settings.get_boolean('display-label');

            let sum = 0; //sum
            let max = 0; //max temp
            for (const temp of tempInfo){
                sum += temp['temp'];
                if (temp['temp'] > max)
                    max = temp['temp'];

                sensorsList.push(new SensorsItem(
                    temp['label'],
                    this._formatTemp(temp['temp']),
                    this._iconTemp
                ));
            }

            if (tempInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());

                // Add average and maximum entries
                sensorsList.push(new SensorsItem(
                    _("Average"),
                    this._formatTemp(sum/tempInfo.length),
                    this._iconTemp
                ));

                sensorsList.push(new SensorsItem(
                    _("Maximum"),
                    this._formatTemp(max),
                    this._iconTemp
                ));

                if(fanInfo.length > 0 || voltageInfo.length > 0)
                    sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }

            for (const fan of fanInfo){
                sensorsList.push(new SensorsItem(
                    fan['label'],
                    _("%drpm").format(fan['rpm']),
                    this._iconFan
                ));
            }

            if (fanInfo.length > 0 && voltageInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }

            for (const voltage of voltageInfo){
                sensorsList.push(new SensorsItem(
                    voltage['label'],
                    _("%s%.2f%s").format(((voltage['volt'] >= 0) ? '+' : '-'), voltage['volt'], voltage['unit']),
                    this._iconVolt
                ));
            }

            for (const item of sensorsList) {
                if(item instanceof SensorsItem) {
                    let label = item.getLabel();

                    // clicking on this menu item will change the label stored
                    // in the settings, which in turn will trigger a refresh
                    // of the whole menu
                    item.connect('activate',
                        () => { this._settings.set_string('main-sensor', label); }
                    );

                    // one menu item should be for the current sensor, which
                    // will also be displayed in the text of the panel button
                    if ( item.configureCurrentSensor( currentSensor ) ){
                        let buttonText = item.getValue();

                        // the text for the panel button may include the sensor label
                        if ( displayLabelInPanel ) {
                            buttonText = label + ': ' + buttonText;
                        }
                        this.statusLabel.set_text(buttonText);
                    }
                }
                section.addMenuItem(item);
            }

            section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // settings

            let item = new PopupMenu.PopupMenuItem( _("Sensors Settings") );
            item.connect('activate',
                () => { imports.misc.extensionUtils.openPrefs(); }
            );
            section.addMenuItem(item);

            // time of update

            /* TRANSLATORS: the placeholder is locale specific time that sensor
               values were last displayed in the menu */
            section.addMenuItem(
                new PopupMenu.PopupMenuItem(
                    _("Last Updated %s").format( new Date().toLocaleTimeString() )
                )
            );
        }else{
            this.statusLabel.set_text(_("Error"));

            let item = new PopupMenu.PopupMenuItem(
                (this.sensorsArgv
                    ? _("Please run sensors-detect as root.")
                    : _("Please install lm_sensors.")) + "\n" + _("If this doesn\'t help, click here to report with your sensors output!")
            );
            item.connect('activate',function() {
                Util.spawn(["xdg-open", "http://github.com/MisterGuinness/gnome-shell-extension-sensors/issues/"]);
            });
            section.addMenuItem(item);
        }

        this.menu.addMenuItem(section);

        Utilities.restoreLocale(oldLocale);
    }

    _toFahrenheit(c) {
        return ((9/5)*c+32);
    }

    _formatTemp(value) {
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
