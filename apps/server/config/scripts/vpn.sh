#!/usr/bin/env bash

privatekey="$WIREGUARD_PRIVATE_KEY"
presharedkey="$WIREGUARD_PRESHARED_KEY"
wireguard_ip="$WIREGUARD_IP"
wireguard_peer="$WIREGUARD_PEER"
wireguard_endpoint="$WIREGUARD_ENDPOINT"
vllm_endpoint="$VLLM_ENDPOINT"
ldap_endpoint="$LDAP_ENDPOINT"

echo "$privatekey" > privatekey
echo "$presharedkey" > presharedkey

ip link add dev wg0 type wireguard

ip address add dev wg0 "$wireguard_ip" peer "$wireguard_peer"

wg set wg0 private-key privatekey \
 peer UBi3x7Cjv4lPABuWcbv7yTOgiDyb2ElLN+39J1gHqnU= preshared-key \
 presharedkey endpoint "$wireguard_endpoint" \
 allowed-ips "$vllm_endpoint","$wireguard_peer"/32,"$ldap_endpoint"

ip link set up dev wg0

ip route add "$vllm_endpoint" via "$wireguard_peer" dev wg0
ip route add "$ldap_endpoint" via "$wireguard_peer" dev wg0
