#!/bin/sh
# Run this to generate all the initial makefiles, etc.
test -n "$srcdir" || srcdir=$(dirname "$0")
test -n "$srcdir" || srcdir=.

olddir=$(pwd)

cd $srcdir

(test -f configure.ac) || {
        echo "*** ERROR: Directory '$srcdir' does not look like the top-level project directory ***"
        exit 1
}

PKG_NAME=$(autoconf --trace 'AC_INIT:$1' configure.ac)

# default to local (per-user) installation
mode="local"

# switch to machine-wide installation only if first parameter specifies that
if [ $# -eq 1 ]; then
  if [ "$1" = "machine" ]; then
    mode="$1"
  fi
fi

# set the directories for configure according to the mode specified
# for a local installation, locale+schemas+icons directories are under the
# extension's directory but for machine-wide, those directories are separate
if [ "$mode" = "local" ]; then
  echo "*** NOTE: local installation will be configured." >&2
  #
  # note: (HOME) causes an error, but {HOME} works fine
  params='--prefix=${HOME}/.local'
  params+=' --with-extension-dir=$(datarootdir)/gnome-shell/extensions/$(uuid)'
  params+=' --with-locale-dir=$(extensiondir)/locale'
  params+=' --with-schema-dir=$(extensiondir)/schemas'
  params+=' --with-icon-dir=$(extensiondir)/icons/hicolor/scalable/status'
else
  echo "*** NOTE: machine wide installation will be configured." >&2
  params='--prefix=/usr'
  params+=' --with-extension-dir=$(datarootdir)/gnome-shell/extensions/$(uuid)'
  params+=' --with-locale-dir=$(datarootdir)/locale'
  params+=' --with-schema-dir=$(datarootdir)glib-2.0/schemas'
  params+=' --with-icon-dir=$(datarootdir)/icons/hicolor/scalable/status'
fi

autoreconf --verbose --force --install || exit 1

cd "$olddir"

if [ "$NOCONFIGURE" = "" ]; then
        $srcdir/configure $params || exit 1

        if [ "$1" = "--help" ]; then
                exit 0
        else
                echo "Now type 'make' to compile $PKG_NAME" || exit 1
        fi
else
        echo "Skipping configure process."
fi
