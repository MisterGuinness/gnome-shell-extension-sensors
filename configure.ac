AC_PREREQ(2.63)

AC_INIT([gnome-shell-extension-sensors],[2.0],[https://github.com/MisterGuinness/gnome-shell-extension-sensors/issues])
AC_SUBST(uuid, [Sensors@MisterGuinness])

AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])

AM_INIT_AUTOMAKE([1.10 dist-xz foreign])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

AC_PROG_SED

GETTEXT_PACKAGE=gnome-shell-extension-sensors
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE, "$GETTEXT_PACKAGE",
                   [The prefix for our gettext translation domains.])

AM_GNU_GETTEXT([external])
AM_GNU_GETTEXT_REQUIRE_VERSION([0.19.8.1])

PKG_PROG_PKG_CONFIG([0.22])

GLIB_GSETTINGS

dnl declare the four "helper" variables to position the four main directories
dnl note: the locale, schema and icon directories can be in different locations
dnl to the main extension directory (refer autogen.sh)

AC_ARG_WITH([extension-dir], [AS_HELP_STRING([--with-extension-dir], [extension directory])])
AC_ARG_WITH([locale-dir], [AS_HELP_STRING([--with-locale-dir], [locale directory])])
AC_ARG_WITH([schema-dir], [AS_HELP_STRING([--with-schema-dir], [schema directory])])
AC_ARG_WITH([icon-dir], [AS_HELP_STRING([--with-icon-dir], [icon directory])])

dnl both localedir and gsettingsschemadir are existing variables, so I am
dnl setting their values as the final step before generating the makefiles

AC_SUBST(extensiondir, [$with_extension_dir])
AC_SUBST(localedir, [$with_locale_dir])
AC_SUBST(gsettingsschemadir, [$with_schema_dir])
AC_SUBST(icondir, [$with_icon_dir])

dnl generate po/Makevars before po/Makefile as there is no Makefile.am for the
dnl translations - Makevars is *inserted* into the Makefile automagically, but
dnl after the substitutions have been done.  In order to get the uuid and
dnl extension-dir variables set in the Makefile (via Makevars), without a
dnl Makefile.am to drive it, the Makevars need to be generated first. So until
dnl I find a better way, the approach is to treat Makevars like a make file and
dnl ac_subst do its thing

AC_CONFIG_FILES([
  Makefile
  data/Makefile
  po/Makevars
  po/Makefile.in
  src/Makefile
])

AC_OUTPUT
