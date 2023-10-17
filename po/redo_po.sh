#! /bin/bash

# This is to refresh the message strings from the newly generated pot file
# and merge with the old po file, with updated source code references, and is
# therefore NOT a translation, so the original translator is not changed.
# Obsolete translations are removed as the po files are under version control.

current_year=$(date +%Y)

package=$(grep AC_INIT ../configure.ac | cut -d[ -f2 | cut -d] -f1)             
version=$(grep AC_INIT ../configure.ac | cut -d[ -f3 | cut -d] -f1)             
bugs=$(grep AC_INIT ../configure.ac | cut -d[ -f4 | cut -d] -f1)                

while read language; do
    echo -n $language

    sed -e "s/^\"Project-Id-Version:.*/\"Project-Id-Version: $package $version\\\n\"/" \
        -e "s|^\"Report-Msgid-Bugs-To:.*|\"Report-Msgid-Bugs-To: $bugs \\\n\"|" \
        -e "s/# Copyright (C) ..../# Copyright (C) $current_year/" \
        $language.po | \
    msgmerge \
        --no-wrap \
        - gnome-shell-extension-sensors.pot | \
    msgattrib \
        --no-wrap \
        --no-obsolete > new_$language.po

done < LINGUAS
