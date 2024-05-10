#! /bin/bash

current_year=$(date +%Y)

package=$(grep AC_INIT ../configure.ac | cut -d[ -f2 | cut -d] -f1)
version=$(grep AC_INIT ../configure.ac | cut -d[ -f3 | cut -d] -f1)
bugs=$(grep AC_INIT ../configure.ac | cut -d[ -f4 | cut -d] -f1)

xgettext \
    --no-wrap \
    --add-comments=TRANSLATORS: \
    --output=- \
    --package-name="$package" \
    --package-version="$version" \
    --copyright-holder="Mister Guinness" \
    --msgid-bugs-address="$bugs" \
    ../src/extension.js ../src/prefs.js ../src/utilities.js | \
    sed -e 's/# SOME DESCRIPTIVE TITLE./# Language translation template file. Generated by redo_pot.sh, DO NOT EDIT./' \
        -e "s/# Copyright (C) YEAR/# Copyright (C) 2021-$current_year/" \
        -e 's/# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR./# adrianbroher <https:\/\/github.com\/adrianbroher>, 2013./' \
        -e '/"POT-Creation-Date: / i "POT-Creation-Date: 2013-05-25 18:09+0200\\n"' \
        -e 's/"POT-Creation-Date:/"PO-Revision-Date:/' \
        -e '/"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE/d' \
        -e 's/"Last-Translator: FULL NAME <EMAIL@ADDRESS>/"Last-Translator: Mister Guinness <https:\/\/github.com\/MisterGuinness>/' \
        -e 's/"Language-Team: LANGUAGE <LL@li.org>/"Language-Team: English/' \
        -e 's/Language: \\n/Language: en\\n/' \
        -e 's/; charset=CHARSET/; charset=UTF-8/' > new.pot
