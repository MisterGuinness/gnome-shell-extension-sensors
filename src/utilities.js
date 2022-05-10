const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const Gettext = imports.gettext;
const Domain = Gettext.domain(Me.metadata['gettext-domain']);
const _ = Domain.gettext;

const ByteArray = imports.byteArray;

const UDisksDriveProxy = Gio.DBusProxy.makeProxyWrapper(
'<node>\
    <interface name="org.freedesktop.UDisks2.Drive">\
        <property type="s" name="Model" access="read"/>\
    </interface>\
</node>');

const UDisksDriveAtaProxy = Gio.DBusProxy.makeProxyWrapper(
'<node>\
    <interface name="org.freedesktop.UDisks2.Drive.Ata">\
        <property type="d" name="SmartTemperature" access="read"/>\
    </interface>\
</node>');

function detectSensors() {
    let path = GLib.find_program_in_path('sensors');
    return path ? [path] : undefined;
}

function detectHDDTemp() {
    let hddtempArgv = GLib.find_program_in_path('hddtemp');
    if(hddtempArgv) {
        // check if this user can run hddtemp directly.
        if(!GLib.spawn_command_line_sync(hddtempArgv)[3])
            return [hddtempArgv];
    }

    // doesn't seem to be the case... is it running as a daemon?
	// Check first for systemd
    let systemctl = GLib.find_program_in_path('systemctl');
    let pidof = GLib.find_program_in_path('pidof');
    let nc = GLib.find_program_in_path('nc');
    let pid = undefined;

    if(systemctl) {
        let [result, activeState] = GLib.spawn_command_line_sync(systemctl + " show hddtemp.service -p ActiveState");
        if(result && ByteArray.toString(activeState).trim() == "ActiveState=active") {
            let [result, output] = GLib.spawn_command_line_sync(systemctl + " show hddtemp.service -p MainPID");
            if (result) {
                output=ByteArray.toString(output).trim();
                if(output.length && output.split("=").length == 2) {
                    pid = Number(output.split("=")[1].trim());
                }
            }
        }
    }

    // systemd isn't used on this system, try sysvinit instead
    if(!pid && pidof) {
        let [result, output] = GLib.spawn_command_line_sync("pidof hddtemp");
        if (result) {
            output=ByteArray.toString(output).trim();
            if(output.length) {
                pid = Number(output.trim());
            }
        }
    }

    if(nc && pid)
    {
        // get daemon command line
        let cmdline = GLib.file_get_contents('/proc/'+pid+'/cmdline');
        // get port or assume default
        let match = /(-p\W*|--port=)(\d{1,5})/.exec(cmdline)
        let port = match ? parseInt(match[2]) : 7634;
        // use net cat to get data
        return [nc, 'localhost', port.toString()];
    }

    // not found
    return undefined;
}

function parseSensorsOutput(txt,parser) {
    let sensors_output = txt.split("\n");
    let feature_label = undefined;
    let feature_value = undefined;
    let sensors = new Array();
    //iterate through each lines
    for(let i = 2; i < sensors_output.length; i++){
        // ignore chipset driver name and 'Adapter:' line for now
        // get every feature of the chip
        if(sensors_output[i]){
           // if it is not a continutation of a feature line
           if(sensors_output[i].indexOf('  ') != 0){
              let feature = parser(feature_label, feature_value);
              if (feature){
                  sensors.push(feature);
                  feature = undefined;
              }
              [feature_label, feature_value] = sensors_output[i].split(':');
           }
           else{
              feature_value += sensors_output[i];
           }
        }
    }
    let feature = parser(feature_label, feature_value);
    if (feature) {
        sensors.push(feature);
        feature = undefined;
    }
    return sensors;
}

function parseSensorsTemperatureLine(label, value) {
    let sensor = undefined;
    if(label != undefined && value != undefined) {
        let curValue = value.trim().split('  ')[0];
        // does the current value look like a temperature unit (ends with C)?
        if(curValue.indexOf("C", curValue.length - "C".length) !== -1){
            sensor = new Array();
            let r;
            sensor['label'] = label.trim();
            sensor['temp'] = parseFloat(curValue.split(' ')[0]);
            sensor['low']  = (r = /low=\+(\d{1,3}.\d)/.exec(value))  ? parseFloat(r[1]) : undefined;
            sensor['high'] = (r = /high=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
            sensor['crit'] = (r = /crit=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
            sensor['hyst'] = (r = /hyst=\+(\d{1,3}.\d)/.exec(value)) ? parseFloat(r[1]) : undefined;
        }
    }
    return sensor;
}

function parseFanRPMLine(label, value) {
    let sensor = undefined;
    if(label != undefined && value != undefined) {
        let curValue = value.trim().split('  ')[0];
        // does the current value look like a fan rpm line?
        if(curValue.indexOf("RPM", curValue.length - "RPM".length) !== -1){
            sensor = new Array();
            let r;
            sensor['label'] = label.trim();
            sensor['rpm'] = parseFloat(curValue.split(' ')[0]);
            sensor['min'] = (r = /min=(\d{1,5})/.exec(value)) ? parseFloat(r[1]) : undefined;
        }
    }
    return sensor;
}

function parseVoltageLine(label, info) {
    let sensor = undefined;
    if(label != undefined && info != undefined) {
        let fields = info.trim().split(' ');
        // voltage info starts with [value][space][unit],
        // so should yield more than one field
        if (fields.length > 1 ) {
            let value = fields[0];
            let unit = fields[1];
            // only check further if the unit is not empty (excluding temps)
            if (unit.length > 0) {
                // does the unit look like a voltage (ends with V)?
                if (unit.lastIndexOf("V") == unit.length - "V".length) {
                    sensor = new Array();
                    let r;
                    sensor['label'] = label.trim();
                    sensor['volt'] = parseFloat(value);
                    sensor['unit'] = unit;
                    sensor['min'] = (r = /min=(\d{1,3}.\d)/.exec(info)) ? parseFloat(r[1]) : undefined;
                    sensor['max'] = (r = /max=(\d{1,3}.\d)/.exec(info)) ? parseFloat(r[1]) : undefined;
                }
            }
        }
    }
    return sensor;
}

function parseHddTempOutput(txt, sep) {
    let hddtemp_output = [];
    if (txt.indexOf((sep+sep), txt.length - (sep+sep).length) >= 0)
    {
        hddtemp_output = txt.split(sep+sep);
    }
	else
    {
        hddtemp_output = txt.split("\n");
    }

    hddtemp_output = hddtemp_output.filter(function(e){ return e; });

    let sensors = new Array();
    for (const line of hddtemp_output)
    {
        let sensor = new Array();
        let fields = line.split(sep).filter(function(e){ return e; });
        sensor['label'] = _("Drive %s").format(fields[0].split('/').pop());
        sensor['temp'] = parseFloat(fields[2]);
        //push only if the temp is a Number
        if (!isNaN(sensor['temp']))
            sensors.push(sensor);
    }
    return sensors;
}

var Future = GObject.registerClass({
    GTypeName: 'MrGFuture'
    }, class Future
    extends GObject.Object {

    _init(argv, callback) {
            this._callback = callback;
            let [exit, pid, stdin, stdout, stderr] =
                GLib.spawn_async_with_pipes(null, /* cwd */
                                            argv, /* args */
                                            null, /* env */
                                            GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                            null /* child_setup */);
            this._stdout = new Gio.UnixInputStream({fd: stdout, close_fd: true});
            this._dataStdout = new Gio.DataInputStream({base_stream: this._stdout});
            new Gio.UnixOutputStream({fd: stdin, close_fd: true}).close(null);

            this._stderr = new Gio.UnixInputStream({fd: stderr, close_fd: true})
            this._dataStderr = new Gio.DataInputStream({base_stream: this._stderr});

            this._childWatch = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status, requestObj) => {
                GLib.source_remove(this._childWatch);
            });

            this._stdoutString = null;
            this._hasError = false;

            this._taskPendingCount = 2;

            this._readStderr();
            this._readStdout();
    }

    _readStderr() {
        this._dataStderr.fill_async(-1, GLib.PRIORITY_DEFAULT, null, (stream, result) => {
            if ( stream.fill_finish( result ) > stream.get_buffer_size() ) {
                stream.set_buffer_size(2 * stream.get_buffer_size());
                this._readStderr();
            } else {
                let text = ByteArray.toString(stream.peek_buffer());
                this._hasError = (text && text.length > 0);
                if (this._hasError) {
                    logToJournal(text);
                }
                if ( --this._taskPendingCount == 0 ) {
                    this._callback(this._stdoutString, this._hasError);
                }
                this._stderr.close(null);
            }
        });
    }

    _readStdout() {
        this._dataStdout.fill_async(-1, GLib.PRIORITY_DEFAULT, null, (stream, result) => {
            if ( stream.fill_finish(result) > stream.get_buffer_size() ) {
                stream.set_buffer_size(2 * stream.get_buffer_size());
                this._readStdout();
            } else {
                this._stdoutString = ByteArray.toString(stream.peek_buffer());
                if ( --this._taskPendingCount == 0 ) {
                    this._callback(this._stdoutString, this._hasError);
                }
                this._stdout.close(null);
            }
        });
    }
});

// Poor man's async.js
const Async = {
    // mapping will be done in parallel
    map: function(arr, mapClb /* function(in, successClb)) */, resClb /* function(result) */) {
        let counter = arr.length;
        let result = [];
        for (let i = 0; i < arr.length; ++i) {
            mapClb(arr[i], (function(i, newVal) {
                result[i] = newVal;
                if (--counter == 0) resClb(result);
            }).bind(null, i)); // i needs to be bound since it will be changed during the next iteration
        }
    }
}

function logToJournal(s)
{
    log( Me.metadata.name + ': ' + s );
}

function debug(str){
    //tail -f -n100 ~/.cache/gdm/session.log | grep temperature
    print ('LOG temperature@xtranophilist: ' + str);
}

// routines for handling of udisks2
var UDisks = {
    // creates a list of sensor objects from the list of proxies given
    create_list_from_proxies: function(proxies) {
        return proxies.filter(function(proxy) {
            // 0K means no data available
            return proxy.ata.SmartTemperature > 0;
        }).map(function(proxy) {
            return {
                label: proxy.drive.Model,
                temp: proxy.ata.SmartTemperature - 272.15
            };
        });
    },

    // calls callback with [{ drive: UDisksDriveProxy, ata: UDisksDriveAtaProxy }, ... ] for every drive that implements both interfaces
    get_drive_ata_proxies: function(callback) {
        Gio.DBusObjectManagerClient.new(Gio.DBus.system, 0, "org.freedesktop.UDisks2", "/org/freedesktop/UDisks2", null, null, function(src, res) {
            try {
                let objMgr = Gio.DBusObjectManagerClient.new_finish(res); //might throw

                let objPaths = objMgr.get_objects().filter(function(o) {
                    return o.get_interface("org.freedesktop.UDisks2.Drive") != null
                        && o.get_interface("org.freedesktop.UDisks2.Drive.Ata") != null;
                }).map(function(o) { return o.get_object_path() });

                // now create the proxy objects, log and ignore every failure
                Async.map(objPaths, function(obj, callback) {
                    // create the proxies object
                    let driveProxy = new UDisksDriveProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, function(res, error) {
                        if (error) { //very unlikely - we even checked the interfaces before!
                            debug("Could not create proxy on "+obj+":"+error);
                            callback(null);
                            return;
                        }
                        let ataProxy = new UDisksDriveAtaProxy(Gio.DBus.system, "org.freedesktop.UDisks2", obj, function(res, error) {
                            if (error) {
                                debug("Could not create proxy on "+obj+":"+error);
                                callback(null);
                                return;
                            }

                            callback({ drive: driveProxy, ata: ataProxy });
                        });
                    });
                }, function(proxies) {
                    // filter out failed attempts == null values
                    callback(proxies.filter(function(a) { return a != null; }));
                });
            } catch (e) {
                debug("Could not find UDisks objects: "+e);
            }
        });
    }
};

function overrideLocale() {
    const path = GLib.build_filenamev([GLib.get_user_config_dir(), "temperature@xtranophilist", "override_locale"]);
    const file = Gio.File.new_for_path(path);

    let newLocale = null;
    try {
        const [success, contents] = file.load_contents(null);
        newLocale = ByteArray.toString(contents).substr(0,10);
    } catch (e) {
        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
            // ignore
        } else {
            debug('Gio.IOErrorEnum=' + e.code);
            throw(e);
        }
    }

    // set the current locale only when there is a new locale to set
    let currentLocale = null;
    if (newLocale != null) {
        currentLocale = Gettext.setlocale(Gettext.LocaleCategory.MESSAGES, null);
        Gettext.setlocale(Gettext.LocaleCategory.MESSAGES,newLocale);
    }
    return currentLocale;
};

function restoreLocale(locale) {
    if (locale != null) {
        Gettext.setlocale(Gettext.LocaleCategory.MESSAGES, locale);
    }
};
