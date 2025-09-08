#! /bin/sh

function shiftleft()
{
  # $1 = name reference, the name of var holding the value
  # $2 = number of decimal places to shift eg 1=multiply by 10, 2=multiply by 100
  local -n p_value=$1
  local p_places=$2

  local length=${#p_value}
  local whole=0
  if [ "$length" -ge "$p_places" ]; then
      ((whole=length-p_places))
      p_value=${p_value:0:$whole}"."${p_value: -$p_places}
  fi
}

declare -A ignore_sensor
declare -A label_sensor

#shopt -p
current_dir="$(dirname $0)"

while read symlink; do
  name=$(cat /sys/class/hwmon/$symlink/name)

  # not sure about outputting the name until the first sensor is output
  # that asus (Eee PC WMI Hotkeys) is in hwmon, but there's no sensors
  echo $name
  echo "Adapter:"

  # how to specify the location of the conf files?
  conf=$current_dir/$name.conf

  [ -r $conf ] && has_conf=1 || has_conf=0

  ignore_sensor=()
  label_sensor=()

  if [ $has_conf -eq 1 ]; then
    while read -a conf_word; do
      num_words=${#conf_word[*]}
      if [ $num_words -gt 1 ]; then
        action=${conf_word[0]}
        sensor=${conf_word[1]}

        case $action in
          "ignore" )
            ignore_sensor[$sensor]="ignore"
          ;;
          "label"  )
            current_word=2
            if [ $current_word -lt $num_words ]; then
              label=${conf_word[$current_word]}

              [ ${label:0:1} == "\"" ] && has_start_quote=1 || has_start_quote=0
              [ ${label: -1:1} == "\"" ] && has_end_quote=1 || has_end_quote=0

              # if the first word was quoted, keep adding more words until end quote
              if [ $has_start_quote -eq 1 ]; then
                ((current_word++))
                while [ $current_word -lt $num_words -a $has_end_quote = 0 ]; do
                  label="$label ${conf_word[$current_word]}"
                  [ ${label: -1:1} == "\"" ] && has_end_quote=1 || has_end_quote=0
                  ((current_word++))
                done
              fi

              # strip off the quotes, first and last characters
              if [ $has_start_quote -eq 1 -a $has_end_quote -eq 1 ]; then
                 label=${label:1: -1}
              fi

              label_sensor[$sensor]=$label
            fi
          ;;
        esac
      fi
    done < $conf
  fi

  while read sensor; do
    # sensor name is of the format "prefix_suffix"
    # prefix is the sensor name with all the text after the underscore removed
    # suffix is the sensor name with all the text before the underscore removed
    prefix="${sensor%%_*}"
    suffix="${sensor##*_}"

    # consider checking that prefix + underscore + suffix = original name
    # maybe just using the lengths is sufficient?

    # prefix is of the format "typeN" where N is one or more digits
    type="$prefix"
    last="${type: -1:1}"
    while [[ "$last" = [0-9] ]]; do
      type="${type:0: -1}"
      last="${type: -1:1}"
    done

    # requires shopt extglob
    #type="${prefix%%+([[:digit:]])}"

    # check the type and suffix are supported
    type_suffix="$type:$suffix"

    [ "$type_suffix" == "fan:input" \
      -o "$type_suffix" == "in:input" \
      -o "$type_suffix" == "power:average" \
      -o "$type_suffix" == "temp:input" ] && supported=1 || supported=0

    if [ "$supported" -eq 1 ]; then
      [ ${ignore_sensor[$prefix]} ] && ignore=1 || ignore=0
    
      if [ $ignore -eq 0 ]; then
        # not ignoring this sensor

        # give it a label (default to prefix)
        if [ "${label_sensor[$prefix]}" ]; then
          display=${label_sensor[$prefix]}
        else
          display=$prefix
        fi

        # read the value from sysfs
        # would be better to limit the chars read to whatever is the max size
        value=$(head -1 /sys/class/hwmon/$symlink/${sensor})

        # determine the units to apply to this value
        units="??"
        case $type in
          "fan" )
             units="RPM"
             ;;
          "in" )
             # voltages in millivolts, multiply by 1,000 to get volts
             if [ $value -lt 1000 ]; then
                units="mV"
             else
                units="V"
                shiftleft "value" 3 
             fi
             ;;
          "power" )
             # power in microwatts, multiply by 1,000,000 to get watts
             units="W"
             shiftleft "value" 6 
             ;;
          "temp" )
             # temps in millidegrees, multiply by 1,000 to get degrees
             units="°C"
             shiftleft "value" 3 
             ;;
        esac

        echo "$display:     $value $units"
      fi
    fi
  done < <(ls -1 /sys/class/hwmon/$symlink)

  # blank line between chips
  # note it adds an unnecessay one at the end
  echo

  #ls -1 /sys/class/hwmon/$symlink/{fan,in,temp}*_input | sed -e 's/_input$//' )

  #ls -la /sys/class/hwmon/$symlink/device
done < <(ls -1 /sys/class/hwmon)

exit 0
