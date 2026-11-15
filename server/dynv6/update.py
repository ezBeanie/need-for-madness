# Keeps the server's DNS name at its own full IPv6 address. A home router that updates dynv6
# itself sends only its prefix, which points the name at the router; and when the provider
# hands out a new prefix, the server's address changes. So a timer (nfm-address.timer) runs
# this every few minutes: it tells dynv6 the address whenever the name points elsewhere, and
# after the address changed it opens the router's pinholes for it again and restarts coturn,
# which reads the server's addresses (and its home network to deny) only when it starts.
# DYNV6_HOST is the name, DYNV6_TOKEN the zone's HTTP token (from an env file of its own).
import os
import socket
import subprocess
import sys
import urllib.parse
import urllib.request

HOST = os.environ["DYNV6_HOST"]
TOKEN = os.environ["DYNV6_TOKEN"]
LAST = os.path.expanduser("~/.cache/nfm-address")


def own_address():
    # The stable global address made from the network card (ff:fe in its middle), not one of
    # the temporary ones that change every day.
    for line in open("/proc/net/if_inet6"):
        address, _, _, scope, _, _ = line.split()
        if scope == "00" and address[22:26] == "fffe" and not address.startswith("fd"):
            return ":".join(address[i:i + 4] for i in range(0, 32, 4))
    sys.exit("no stable global IPv6 address found")


def named():
    try:
        found = socket.getaddrinfo(HOST, None, socket.AF_INET6)
    except socket.gaierror:
        return set()
    return {socket.inet_pton(socket.AF_INET6, entry[4][0]) for entry in found}


address = own_address()
packed = socket.inet_pton(socket.AF_INET6, address)
if named() != {packed}:
    query = urllib.parse.urlencode({"hostname": HOST, "token": TOKEN, "ipv6": address})
    answer = urllib.request.urlopen(f"https://dynv6.com/api/update?{query}", timeout=10)
    print("dynv6:", answer.read().decode().strip())

try:
    last = open(LAST).read().strip()
except FileNotFoundError:
    last = None
if last != address:
    if last is not None:
        subprocess.run(["systemctl", "--user", "start", "nfm-pinholes.service"], check=True)
        subprocess.run(["docker", "restart", "nfm-turn"], check=True, stdout=subprocess.DEVNULL)
        print("address changed: pinholes renewed, coturn restarted")
    os.makedirs(os.path.dirname(LAST), exist_ok=True)
    with open(LAST, "w") as file:
        file.write(address)
