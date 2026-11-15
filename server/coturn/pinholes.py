# Opens coturn's ports in the router's IPv6 firewall over UPnP (WANIPv6FirewallControl), for a
# server behind a home router such as a FRITZ!Box with "selbstständige Portfreigaben" allowed.
# The router keeps a pinhole for a day at most, so a timer runs this again before that
# (nfm-pinholes.timer); adding a pinhole again only renews it. With "status" it only tells
# whether the router allows pinholes. Python's standard library only, nothing to install.
import re
import socket
import sys
import urllib.error
import urllib.request
from urllib.parse import urljoin

SERVICE = "urn:schemas-upnp-org:service:WANIPv6FirewallControl:1"
LEASE = 86400
UDP, TCP = 17, 6
# 3478 as in turnserver.conf, and its min-port..max-port for the voices passed on
HOLES = [(UDP, 3478), (TCP, 3478)] + [(UDP, port) for port in range(49160, 49201)]


def control_url():
    search = (
        "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\n"
        "ST: urn:schemas-upnp-org:device:InternetGatewayDevice:2\r\n\r\n"
    ).encode()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3)
    sock.sendto(search, ("239.255.255.250", 1900))
    answer, _ = sock.recvfrom(4096)
    location = re.search(rb"(?i)location:\s*(\S+)", answer).group(1).decode()
    device = urllib.request.urlopen(location, timeout=5).read().decode()
    for service in re.findall(r"<service>(.*?)</service>", device, re.S):
        if SERVICE in service:
            return urljoin(location, re.search(r"<controlURL>(.*?)</controlURL>", service).group(1))
    sys.exit("the router offers no IPv6 firewall control over UPnP")


def call(url, action, **args):
    body = "".join(f"<{name}>{value}</{name}>" for name, value in args.items())
    envelope = (
        '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
        's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>'
        f'<u:{action} xmlns:u="{SERVICE}">{body}</u:{action}></s:Body></s:Envelope>'
    )
    request = urllib.request.Request(url, envelope.encode(), {
        "Content-Type": 'text/xml; charset="utf-8"',
        "SOAPAction": f'"{SERVICE}#{action}"',
    })
    try:
        return True, urllib.request.urlopen(request, timeout=5).read().decode()
    except urllib.error.HTTPError as error:
        return False, error.read().decode()


def own_address():
    # The stable global address made from the network card (ff:fe in its middle), not one of
    # the temporary ones that change every day.
    for line in open("/proc/net/if_inet6"):
        address, _, _, scope, _, _ = line.split()
        if scope == "00" and address[22:26] == "fffe" and not address.startswith("fd"):
            return ":".join(address[i:i + 4] for i in range(0, 32, 4))
    sys.exit("no stable global IPv6 address found")


url = control_url()
_, status = call(url, "GetFirewallStatus")
allowed = re.search(r"<InboundPinholeAllowed>1<", status) is not None
print("router allows pinholes:", allowed)
if not allowed:
    sys.exit(1)
if sys.argv[1:] == ["status"]:
    sys.exit()

address = own_address()
failed = []
for protocol, port in HOLES:
    done, answer = call(url, "AddPinhole", RemoteHost="", RemotePort=0, InternalClient=address,
                        InternalPort=port, Protocol=protocol, LeaseTime=LEASE)
    if not done:
        failed.append((protocol, port, re.findall(r"<errorDescription>(.*?)<", answer)))
print(f"pinholes open: {len(HOLES) - len(failed)} of {len(HOLES)}")
for protocol, port, reason in failed:
    print("failed:", "UDP" if protocol == UDP else "TCP", port, reason)
sys.exit(1 if failed else 0)
