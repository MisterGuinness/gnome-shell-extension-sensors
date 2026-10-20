import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import Gettext from 'gettext';

function debug(str){
    //tail -f -n100 ~/.cache/gdm/session.log | grep temperature
    print ('LOG temperature@xtranophilist: ' + str);
}

export function overrideLocale(uuid) {
    const path = GLib.build_filenamev([GLib.get_user_config_dir(), uuid, "override_locale"]);
    const file = Gio.File.new_for_path(path);

    let newLocale = null;
    try {
        const [success, contents] = file.load_contents(null);
        const decoder = new TextDecoder();
        newLocale = decoder.decode(contents).substr(0,10);
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

export function restoreLocale(locale) {
    if (locale != null) {
        Gettext.setlocale(Gettext.LocaleCategory.MESSAGES, locale);
    }
};
