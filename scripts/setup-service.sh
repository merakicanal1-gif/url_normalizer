#!/usr/bin/env bash

# Exit on error
set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # Sem cor

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Configurando o serviço URL Normalizer no systemd...${NC}"
echo -e "${GREEN}=====================================================${NC}"

# 1. Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Este script deve ser executado como root (com sudo).${NC}"
  echo "Exemplo: sudo ./scripts/setup-service.sh"
  exit 1
fi

# 2. Obter o usuário real e o diretório absoluto do projeto
REAL_USER=${SUDO_USER:-$(whoami)}
PROJECT_DIR=$(pwd)

# Validar se o diretório do projeto parece correto
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  echo -e "${RED}Erro: Execute este script a partir da raiz do projeto.${NC}"
  exit 1
fi

echo -e "Usuário do serviço: ${GREEN}$REAL_USER${NC}"
echo -e "Diretório de trabalho: ${GREEN}$PROJECT_DIR${NC}"

# 3. Compilar o projeto TypeScript para garantir que a pasta dist exista
echo "Executando build do projeto..."
sudo -u "$REAL_USER" npm run build

# 4. Criar o arquivo de serviço systemd
SERVICE_FILE="/etc/systemd/system/url-normalizer.service"

echo "Criando o arquivo de serviço em $SERVICE_FILE..."
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=URL Normalizer API Service
After=network.target tailscaled.service

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production PORT=3007 HOST=0.0.0.0 PLAYWRIGHT_HEADLESS=true
StandardOutput=inherit
StandardError=inherit

[Install]
WantedBy=multi-user.target
EOF

# 5. Habilitar e iniciar o serviço
echo "Recarregando daemons do systemd..."
systemctl daemon-reload

echo "Habilitando inicialização automática do serviço..."
systemctl enable url-normalizer.service

echo "Iniciando o serviço..."
systemctl restart url-normalizer.service

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Serviço URL Normalizer configurado com sucesso!${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""
echo "Comandos úteis para gerenciar o serviço:"
echo "  - Ver status:   systemctl status url-normalizer"
echo "  - Ver logs:     journalctl -u url-normalizer -n 50 -f"
echo "  - Reiniciar:    systemctl restart url-normalizer"
echo "  - Parar:        systemctl stop url-normalizer"
echo ""
EOF
