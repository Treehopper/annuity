#!/bin/bash
# Default-deny egress firewall. Only the domains in /usr/local/etc/allowed-domains.txt,
# DNS and the Docker host network are reachable. GitHub is deliberately not reachable,
# so commits stay local and pushing is only possible from the host.
set -euo pipefail
IFS=$'\n\t'

ALLOWLIST=/usr/local/etc/allowed-domains.txt

# Keep Docker's embedded DNS NAT rules before flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

# DNS and loopback before anything else, so resolution below works
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT -p tcp --sport 53 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

while read -r domain; do
    domain="${domain%%#*}"
    domain="${domain//[[:space:]]/}"
    [ -z "$domain" ] && continue
    ips=$(dig +short +time=3 +tries=2 A "$domain" | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || true)
    if [ -z "$ips" ]; then
        echo "WARNING: Failed to resolve $domain, skipping"
        continue
    fi
    while read -r ip; do
        ipset add -exist allowed-domains "$ip"
    done <<< "$ips"
    echo "Allowed $domain"
done < "$ALLOWLIST"

# Docker host network (VS Code server, port forwarding)
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network: $HOST_NETWORK"
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# No IPv6 egress at all (the allowlist is IPv4 only)
if ip6tables -L >/dev/null 2>&1; then
    ip6tables -F
    ip6tables -A INPUT -i lo -j ACCEPT
    ip6tables -A OUTPUT -o lo -j ACCEPT
    ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    ip6tables -P INPUT DROP
    ip6tables -P FORWARD DROP
    ip6tables -P OUTPUT DROP
fi

echo "Firewall configured, verifying..."
for url in https://example.com https://github.com https://api.github.com; do
    if curl -sS --connect-timeout 5 -o /dev/null "$url" 2>/dev/null; then
        echo "ERROR: Verification failed, reached $url"
        exit 1
    fi
    echo "OK: $url is blocked"
done
for url in https://registry.npmjs.org/ https://api.anthropic.com; do
    if ! curl -sS --connect-timeout 5 -o /dev/null "$url"; then
        echo "ERROR: Verification failed, cannot reach $url"
        exit 1
    fi
    echo "OK: $url is reachable"
done
