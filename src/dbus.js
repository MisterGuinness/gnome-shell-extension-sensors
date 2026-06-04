import Gio from 'gi://Gio';

var proxies = new Array();

export function clearDriveProxies() {
    proxies = new Array();
}

export function haveDriveProxies() {
    return proxies.length > 0
}

export async function makeDriveProxies() {
    const systemConnection = Gio.DBus.system;
    const udisksName = "org.freedesktop.UDisks2";
    const udisksPath = "/org/freedesktop/UDisks2";

    clearDriveProxies();

    // create a new manager client that can list out all the objects
    // wrap the client in a promise so that the async result can be awaited
    // use the client's callback to finish the result and resolve the promise
    // refer https://docs.gtk.org/gio/type_func.DBusObjectManagerClient.new.html

    let managerClient = null;

    try {
        managerClient = await new Promise((resolve, reject) => {
            Gio.DBusObjectManagerClient.new(
                systemConnection,
                Gio.G_DBUS_OBJECT_MANAGER_CLIENT_FLAGS_NONE,
                udisksName,
                udisksPath,
                null, // always construct GDBusProxy proxies
                null, // not cancellable
                // async callback
                // refer https://docs.gtk.org/gio/callback.AsyncReadyCallback.html
                (source_object, res) => {
                    if (res === null)
                        reject("Gio.DBusObjectManagerClient.new null result");
                    else
                        // https://docs.gtk.org/gio/ctor.DBusObjectManagerClient.new_finish.html
                        resolve(Gio.DBusObjectManagerClient.new_finish(res));
                }
            );
        });
    } catch(e) {
        console.error(e);
    }

    // get an array of objects for the requested path (ie all UDisks objects)
    // refer https://docs.gtk.org/gio/method.DBusObjectManager.get_objects.html
    let objects = null;

    if (managerClient) {
        objects = managerClient.get_objects();
    }

    const interfaceDriveXML = `
    <node>
        <interface name="org.freedesktop.UDisks2.Drive">
            <property name="Model" type="s" access="read"/>
        </interface>
    </node>`;

    const interfaceDriveAtaXML = `
    <node>
        <interface name="org.freedesktop.UDisks2.Drive.Ata">
            <property name="SmartTemperature" type="d" access="read"/>
        </interface>
    </node>`;

    const proxyDriveClass = Gio.DBusProxy.makeProxyWrapper(interfaceDriveXML);
    const proxyDriveAtaClass = Gio.DBusProxy.makeProxyWrapper(interfaceDriveAtaXML);

    // the 'for (x of iterable-array)' will handle await on promises
    for (const object of objects) {

        // check that this object has both the interfaces we want
        if ( object.get_interface("org.freedesktop.UDisks2.Drive") != null
            && object.get_interface("org.freedesktop.UDisks2.Drive.Ata") != null ) {

            const path = object.get_object_path();

            // create proxies for each interface for this object (ie drive)
            // the first is to access the model, and
            // the second is to access the temperature
            // refer https://gjs.guide/guides/gio/dbus.html#high-level-proxies
            try {
                const driveProxy = await new Promise((resolve, reject) => {
                    proxyDriveClass(
                        systemConnection,
                        udisksName,
                        path,
                        (proxy, error) => {
                            if (error === null)
                                resolve(proxy);
                            else
                                reject(error);
                        },
                        null, // not cancellable
                        Gio.DBusProxyFlags.NONE
                    );
                });

                const driveAtaProxy = await new Promise((resolve, reject) => {
                    proxyDriveAtaClass(
                        systemConnection,
                        udisksName,
                        path,
                        (proxy, error) => {
                            if (error === null)
                                resolve(proxy);
                            else
                                reject(error);
                        },
                        null, // not cancellable
                        Gio.DBusProxyFlags.NONE
                    );
                });

                // package as properties of a new object and append to the array of proxies
                proxies.push({ drive: driveProxy, ata: driveAtaProxy });

            } catch(e) {
                console.error(e);
            }
        }
    }
}

// https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.Drive.Ata.html#gdbus-property-org-freedesktop-UDisks2-Drive-Ata.SmartTemperature
//
// The temperature (in Kelvin) of the disk according to SMART data or 0 if unknown.
//
// https://cdn.standards.iteh.ai/samples/80702/17080fbc3edd438f98fb84b33a40e1da/ISO-1-2022.pdf
//
// The SI unit of temperature is the kelvin (K). The unit degree Celsius (°C)
// is linked by a fixed shift of scale, according to Formula (B.1):
//   t = T – T0
// where T0 = 273,15 K
// or equivalently to Formula (B.2):
//   t/°C = T/K – 273,15
//
// Note: the original code for below had "...SmartTemperatue - 272.15"
export function getDriveTemps(labelPrefix) {
    // 0K means no data available
    return proxies
        .filter((proxy) => proxy.ata.SmartTemperature > 0)
        .map((proxy) => ({
                label: labelPrefix.format(proxy.drive.Model),
                temp: proxy.ata.SmartTemperature - 273.15
            })
        )
}
