#!/bin/sh
# Starts coturn with turnserver.conf, the secret it shares with the relay (TURN_SECRET, from
# the relay's env file) and the address the server is reached at from the internet now (a
# DynDNS address changes: restart the container after it did). The secret goes into a copy
# of the configuration in the container's memory, not on its command line.
set -eu
config=/tmp/turnserver.conf
cp /etc/coturn/turnserver.conf "$config"
echo "static-auth-secret=$TURN_SECRET" >> "$config"
echo "external-ip=$(detect-external-ip)" >> "$config"
# (the log as an option of its own: in the configuration, coturn opens one in /var/tmp first)
exec turnserver -c "$config" --no-stdout-log --simple-log --log-file=/dev/null
