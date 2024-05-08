import GLib from 'gi://GLib'; // for timeout
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js'; // for spawn
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Utilities from './utilities.js';
import * as SubProc from './subproc.js';

const SensorsItem = GObject.registerClass({
    GTypeName: 'SensorsItem'
    }, class SensorsItem
    extends PopupMenu.PopupBaseMenuItem {

    _init(label, value, icon) {
        super._init();
        this._label = label;
        this._value = value;

        this.add_child(new St.Icon({gicon: icon, style_class: 'popup-menu-icon'}));
        this.add_child(new St.Label({text: label}));
        this.add_child(new St.Label({text: value, x_expand: true, x_align: Clutter.ActorAlign.END}));
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
        else
        {
            // add an empty ornament to maintain alignment in menu
            this.setOrnament(PopupMenu.Ornament.NONE);
        }
    }
});

const SensorsMenuButton = GObject.registerClass({
    GTypeName: 'SensorsMenuButton'
    }, class SensorsMenuButton
    extends PanelMenu.Button {

    _init( name )
    {
        super._init(null, 'sensorMenu');

        this._statusLabel = new St.Label({ text: name, y_expand: true, y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._statusLabel);
    }

    setLabel( label ) {
        this._statusLabel.set_text( label );
    }

    addMenuItem( item ) {
        this.menu.addMenuItem( item );
    }

    removeAll() {
        this.menu.removeAll();
    }
});

export default class SensorsExtension
    extends Extension
{
    enable() {
        // create icons for menu
        this._iconTemp = Gio.icon_new_for_string(this.path + '/icons/hicolor/scalable/status/sensors-temperature-symbolic.svg');
        this._iconFan = Gio.icon_new_for_string(this.path + '/icons/hicolor/scalable/status/sensors-fan-symbolic.svg');
        this._iconVolt = Gio.icon_new_for_string(this.path + '/icons/hicolor/scalable/status/sensors-voltage-symbolic.svg');

        this._settings = this.getSettings();

        this.sensorsArgv = Utilities.detectSensors();
        this.hddtempArgv = null;

        this.udisksProxies = [];
        Utilities.UDisks.get_drive_ata_proxies( (proxies) => {
            this.udisksProxies = proxies;
        });

        this._settingsChanged = this._settings.connect('changed', this._querySensors.bind(this));

        this._sensorsMenu = new SensorsMenuButton( this.metadata.name );
        Main.panel.addToStatusArea('sensorsMenu', this._sensorsMenu, 1, 'right');

        // don't postpone the first call by update-time.
        this._querySensors().catch( e => { console.warn(e); });

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._settings.get_int('update-time'), () => {
            this._querySensors().catch( e => { console.warn(e); });
            // NOTE: return continue to fire the timer again
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._iconTemp = null;
        this._iconFan = null;
        this._iconVolt = null;

        GLib.Source.remove(this._timeoutId);

        // remove the menu button from the panel
        // which will in turn remove the section,
        // which will in turn remove the menu items
        this._sensorsMenu.destroy();
        this._sensorsMenu = null;

        this._settings.disconnect(this._settingsChanged);
        this._settings = null;

        this.hddtempArgv = null;
    }

    async _querySensors() {
        let hasSensorsError = false;
        let hasHDDTempError = false;
        let sensorsOutput;
        let HDDTempOutput;

        if (this.sensorsArgv){
            [ sensorsOutput, hasSensorsError ] = await SubProc.runCommandAsync(this.sensorsArgv);
        }

        // NOTE: the user can decide to display HDD Temp output, or not, while
        // the extension is running (via settings)
        if (this._settings.get_boolean('display-hdd-temp'))
        {
            // if the command for hddtemp has not been previously identified
            if ( this.hddtempArgv == null )
            {
                this.hddtempArgv = Utilities.detectHDDTemp();
            }
        }
        else
        {
            // clear the hddtemp command if not required to run according to
            // settings, turning on again will determine the command again
            this.hddtempArgv = null;
        }

        if (this.hddtempArgv){
            [ HDDTempOutput, hasHDDTempError ] = await SubProc.runCommandAsync(this.hddtempArgv);
        }

        this._updateDisplay(sensorsOutput, HDDTempOutput, hasSensorsError || hasHDDTempError);

        return true;
    }

    _updateDisplay(sensors_output, hddtemp_output, hasError) {
        let display_fan_rpm = this._settings.get_boolean('display-fan-rpm');
        let display_voltage = this._settings.get_boolean('display-voltage');

        let tempInfo = Array();
        let fanInfo = Array();
        let voltageInfo = Array();

        const oldLocale = Utilities.overrideLocale(this.uuid);

        tempInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseSensorsTemperatureLine);
        if (display_fan_rpm){
            fanInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseFanRPMLine);
        }
        if (display_voltage){
            voltageInfo = Utilities.parseSensorsOutput(sensors_output,Utilities.parseVoltageLine);
        }

        if(this.hddtempArgv)
            // provide the drive label to utilities so all translations are
            // performed inside this module
            tempInfo = tempInfo.concat( Utilities.parseHddTempOutput(
                    hddtemp_output,
                    !(/nc$/.exec(this.hddtempArgv[0])) ? ': ' : '|',
                    _("Drive %s")
            ));

        tempInfo = tempInfo.concat(Utilities.UDisks.create_list_from_proxies(this.udisksProxies));

        tempInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });
        fanInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });
        voltageInfo.sort(function(a,b) { return a['label'].localeCompare(b['label']) });

        this._sensorsMenu.removeAll();
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
                    "%s%.2f%s".format(((voltage['volt'] >= 0) ? '+' : '-'), voltage['volt'], voltage['unit']),
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
                        this._sensorsMenu.setLabel(buttonText);
                    }
                }
                section.addMenuItem(item);
            }

            section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // settings

            let item = new PopupMenu.PopupMenuItem( _("Sensors Settings") );
            item.connect('activate',
                () => { this.openPreferences(); }
            );
            section.addMenuItem(item);

            // time of update
            section.addMenuItem(
                new PopupMenu.PopupMenuItem(
                    /* TRANSLATORS: the placeholder is locale specific time that sensor
                       values were last displayed in the menu */
                    _("Last Updated %s").format( new Date().toLocaleTimeString() )
                )
            );
        }else{
            this._sensorsMenu.setLabel(_("Error"));

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

        this._sensorsMenu.addMenuItem(section);

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
}
