#!/usr/bin/env bash

set -e

echo "Configurando conexión WireGuard..."

if ! /app/apps/server/config/vpn.sh; then
    echo "Error al configurar VPN, continuando sin ella..."
else
    echo "VPN configurada exitosamente"
fi

echo "Iniciando..."
cd apps/server && cargo watch -x run -w src -w config
