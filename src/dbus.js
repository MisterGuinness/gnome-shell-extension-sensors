import Gio from 'gi://Gio';

const systemConnection = Gio.DBus.system;
const udisksName = "org.freedesktop.UDisks2";
const udisksPath = "/org/freedesktop/UDisks2";

// refer https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.Drive.html
// and   https://dbus.freedesktop.org/doc/dbus-specification.html#type-system
// NOTE: SmartTemperature is
// type "d" (double-precusion floating point) for Drive Ata, but
// type "q" (unit16) for NVMe, but I suspect the doc is wrong and is a "d"
const interfaceDriveXML = `
<node>
    <interface name="org.freedesktop.UDisks2.Drive">
        <property name="Model" type="s" access="read"/>
    </interface>
</node>`;

// refer https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.Drive.Ata.html
const interfaceDriveAtaXML = `
<node>
    <interface name="org.freedesktop.UDisks2.Drive.Ata">
        <property name="SmartTemperature" type="d" access="read"/>
    </interface>
</node>`;

// refer https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.NVMe.Controller.html
const interfaceNVMeControllerXML = `
<node>
    <interface name="org.freedesktop.UDisks2.NVMe.Controller">
        <property name="SmartTemperature" type="q" access="read"/>
    </interface>
</node>`;

// create proxy classes once only, not every time makeDriveProxies is called
const proxyDriveClass = Gio.DBusProxy.makeProxyWrapper(interfaceDriveXML);
const proxyDriveAtaClass = Gio.DBusProxy.makeProxyWrapper(interfaceDriveAtaXML);
const proxyNVMeControllerClass = Gio.DBusProxy.makeProxyWrapper(interfaceNVMeControllerXML);

var proxies = new Array();

export function clearDriveProxies() {
    proxies = new Array();
}

export function haveDriveProxies() {
    return proxies.length > 0
}

export async function makeDriveProxies() {

    clearDriveProxies();

    // create a new manager client that can list out all the objects
    const managerClient = await newManagerClient( udisksPath );

    if ( managerClient === null ) {
        return;
    }

    // get an array of objects for the requested path (ie all UDisks objects)
    // refer https://docs.gtk.org/gio/method.DBusObjectManager.get_objects.html
    const objects = managerClient.get_objects();

    if ( objects === null ) {
        console.error( "Could not get objects on DBusObjectManagerClient" );
        return;
    }

    // the 'for (x of iterable-array)' will handle await on promises
    for (const object of objects) {

        // check that this object has the interface we want
        if ( object.get_interface("org.freedesktop.UDisks2.Drive") === null ) {
            // nope, proceed to next object, it may have the required interface
            continue;
        }

        // det the path for this object, for use in creating proxies below
        const drivePath = object.get_object_path();

        // create proxies for each interface for this object
        // the first is to access the model, and
        // refer https://gjs.guide/guides/gio/dbus.html#high-level-proxies

        const driveProxy = await newDriveProxy( proxyDriveClass, drivePath );

        if ( driveProxy === null ) {
            // proceed to next object, it may have a drive proxy
            continue;
        }

        // the second proxy is to access the temperature
        // either for an ATA drive, or an NVMe Controller

        let drivePropertiesProxy = null;

        if ( object.get_interface("org.freedesktop.UDisks2.Drive.Ata") != null ) {
            drivePropertiesProxy = await newDriveProxy( proxyDriveAtaClass, drivePath );
        } else {
            if ( object.get_interface("org.freedesktop.UDisks2.NVMe.Controller") != null ) {
                drivePropertiesProxy = await newDriveProxy( proxyNVMeControllerClass, drivePath );
            } else {
                // drive has neither ATA nor NVMe interface (eg a USB stick)
                // proceed to next object
                continue;
            }
        }

        if ( drivePropertiesProxy ) {
            // package as properties of a new object and append to the array of proxies
            proxies.push({ drive: driveProxy, properties: drivePropertiesProxy });
        }
    }
}

async function newManagerClient( path ) {

    // wrap the client in a promise so that the async result can be awaited
    // use the client's callback to finish the result and resolve the promise
    // refer https://docs.gtk.org/gio/type_func.DBusObjectManagerClient.new.html

    let client = null

    try {
        client = await new Promise((resolve, reject) => {
            Gio.DBusObjectManagerClient.new(
                systemConnection,
                Gio.G_DBUS_OBJECT_MANAGER_CLIENT_FLAGS_NONE,
                udisksName,
                path,
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

    if ( client === null ) {
        console.error( "Could not create DBusObjectManagerClient" );
    }

    return client;
}

async function newDriveProxy( proxyClass, path ) {
    let proxy = null;

    try {
        proxy = await new Promise((resolve, reject) => {
            new proxyClass(
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
    } catch(e) {
        console.error(e);
    }

    if ( proxy === null ) {
        console.warn( "Could not create drive proxy for " + path );
    }

    return proxy;
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
        .filter((proxy) => proxy.properties.SmartTemperature > 0)
        .map((proxy) => ({
                label: labelPrefix.format(proxy.drive.Model),
                temp: proxy.properties.SmartTemperature - 273.15
            })
        )
}
