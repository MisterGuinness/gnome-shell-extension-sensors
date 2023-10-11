import GLib from 'gi://GLib';   // only for spawn async
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

const ByteArray = imports.byteArray;

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

import * as Utilities from './utilities.js';

const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

export default class SensorsPreferences
    extends ExtensionPreferences
{
    constructor(metadata) {
        super(metadata);

        this.initTranslations();
    }

    fillPreferencesWindow(window) {
        const oldLocale = Utilities.overrideLocale();

        // increase the window height slightly to accommodate the new group
        // titles, and moving the final checkbox onto a separate line
        let width = 0, height = 0;
        [ width, height ] = window.get_default_size();
        window.set_default_size(width, height + 115);

        // create a settings object
        this._settings = this.getSettings();

        // create a preferences page
        const page = new Adw.PreferencesPage();
        window.add(page);

        // create a grouping for the settings related to sensors in the menu
        let group = new Adw.PreferencesGroup({ title: _('Sensors in Menu') });
        page.add(group);

        // the settings...
        // 1. poll time
        group.add( this._bindSpinRowWithAdjustment(
            'update-time',
            _('Poll sensors every (in seconds)'),
            5, 100, 5, 10
        ));

        // 2. temperature unit
        group.add( this._bindActionRowWithRadios(
           'unit',
            _('Temperature unit'),
            [ _('Centigrade'), _('Fahrenheit') ],
            [ 'Centigrade', 'Fahrenheit' ]
        ));

        // 3. append temperature unit to temperatures
        group.add( this._bindSwitchRow(
            'display-degree-sign',
            _('Display temperature unit'),
            _('Show temperature unit in panel and menu.')
        ));

        // 4. decimals
        group.add( this._bindSwitchRow(
            'display-decimal-value',
            _('Display decimal value'),
            _('Show one digit after decimal.')
        ));

        // 5. drive temps from hddtemp utility
        group.add( this._bindSwitchRow(
            'display-hdd-temp',
            _('Display drive temperature') + ' (hddtemp)',
            ''
        ));

        // 6. fans
        group.add( this._bindSwitchRow(
            'display-fan-rpm',
            _('Display fan speed'),
            ''
        ));

        // 7. voltages
        group.add( this._bindSwitchRow(
            'display-voltage',
            _('Display power supply voltage'),
            ''
        ));

        // create second group for panel related settings
        group = new Adw.PreferencesGroup({ title: _('Sensor in panel') });
        page.add(group);

        // 8. sensor to display in panel

        // build the list of sensor labels for the combo
        // note: GTK StringList provides a get_string method, and
        // implements GIO GListModel which provides get_n_items
        // GTK StringList is suitable for use in ComboRow model
        this._sensorList = new Gtk.StringList();
        this._sensorList.append( _("Average") );
        this._sensorList.append( _("Maximum") );

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

        group.add( this._bindComboRow(
            'main-sensor',
            _('Sensor in panel'),
            this._sensorList
        ));

        // 9. include sensor name in panel
        group.add( this._bindSwitchRow(
            'display-label',
            _('Display sensor label'),
            ''
        ));

        Utilities.restoreLocale(oldLocale);
    }

    _appendMultipleItems(sensorInfo) {
        for (const sensor of sensorInfo) {
            this._sensorList.append(sensor['label']);
        }
    }

    _bindSpinRowWithAdjustment( settings_key, title, lower, upper, step, page )
    {
        if ( lower > 0 && upper > lower && step > 0 && page > step )
        {
            // create and adjustment to specify the bounds of the spinner
            const adj = new Gtk.Adjustment({
                lower: lower,
                upper: upper,
                step_increment: step,
                page_increment: page } );

            // create a new preferences row
            const row = new Adw.SpinRow({
                title: title,
                adjustment: adj,
                snap_to_ticks: true
            });

            // bind the row to the settings schema key
            this._settings.bind(settings_key, row, 'value',
                Gio.SettingsBindFlags.DEFAULT);

            return row;
        }
    }

    _bindActionRowWithRadios( settings_key, title, radioLabels, settingsValues )
    {
        // check that there is a minimum of 2 radio buttons to form a group
        const radioCount = radioLabels.length;
        const settingsCount = settingsValues.length;

        // create a new preferences row
        const row = new Adw.ActionRow({
            title: title
        });

        if ( radioCount > 1 && settingsCount == radioCount )
        {
            let radio = new Gtk.CheckButton({ label: radioLabels[0] });
            let first_radio = radio;

            for( let i = 0; i < radioCount; i++ )
            {
                if ( i > 0 )
                {
                    radio = new Gtk.CheckButton({ group: first_radio, label: radioLabels[i] });
                }

                row.add_suffix( radio );

                if ( this._settings.get_string( settings_key ) == settingsValues[i] )
                {
                    radio.active = true;
                }

                radio.connect('toggled', () => { this._settings.set_string(settings_key, settingsValues[i]) });
            }

            this._settings.connect('changed::unit', (settings, key) => {
                console.log(`${key} = ${settings.get_value(key).print(true)}`);
            });
        }

        return row;
    }

    _bindSwitchRow( settings_key, title, subtitle )
    {
        // Create a new preferences row
        const row = new Adw.SwitchRow({
            title: title,
            subtitle: subtitle
        });

        // bind the row to the settings schema key
        this._settings.bind(settings_key, row, 'active',
            Gio.SettingsBindFlags.DEFAULT);

        return row;
    }

    _bindComboRow( settings_key, title, model )
    {
        // Create a new preferences row
        const row = new Adw.ComboRow({
            title: title,
            model: model
        });

        const activeSensor = this._settings.get_string('main-sensor');
        row.set_selected( this._findActiveSensor( row, activeSensor ));

        // bind the row to the settings schema key
        row.connect('notify::selected-item', (comboRow) =>
        {
            const position = comboRow.get_selected();
            const value = comboRow.get_model().get_string(position);
            this._settings.set_string( settings_key, value );
        });

        return row;
    }

    _getSensorsLabels() {
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
    }

    _getHddTempLabels() {
        let hddtemp_cmd = Utilities.detectHDDTemp();
        if(hddtemp_cmd){
            let [result, hddtemp_output] = GLib.spawn_command_line_sync(hddtemp_cmd.join(' '))
            if(result){
                let hddTempInfo = Utilities.parseHddTempOutput(
                    ByteArray.toString(hddtemp_output),
                    !(/nc$/.exec(hddtemp_cmd[0])) ? ': ' : '|',
                    _("Drive %s")	
		);
                this._appendMultipleItems(hddTempInfo);
            }
        }
    }

    _getUdisksLabels() {
        Utilities.UDisks.get_drive_ata_proxies((function(proxies) {
            let list = Utilities.UDisks.create_list_from_proxies(proxies);

            this._appendMultipleItems(list);
        }).bind(this));
    }

    _findActiveSensor(comboRow, activeSensor) {

        let position = 0;
        let label = comboRow.get_model().get_string(position);
        let found = false;

        while (label && !found) {
            if (label == activeSensor) {
                found = true;
            }
            else {
                label = comboRow.get_model().get_string(++position);
            }
        }

        if (!found) {
            // default to first item in list
            position = 0;
        }

        return position;
    }
}
