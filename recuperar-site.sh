#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "Procurando backup original..."

BACKUP=$(find . -maxdepth 1 -type d \
  -name 'backup-modernizacao-*' | sort | tail -n 1)

if [ -z "$BACKUP" ] || [ ! -d "$BACKUP/public" ]; then
    echo "ERRO: backup da pasta public não encontrado."
    echo "Nenhum arquivo foi apagado."
    exit 1
fi

echo "Backup encontrado: $BACKUP"

# Preserva o estado atual antes de recuperar.
mkdir -p backup-pos-falha
cp -a public "backup-pos-falha/public-$(date +%Y%m%d-%H%M%S)"

# Restaura os arquivos anteriores à modernização.
rm -rf public
cp -a "$BACKUP/public" public

echo
echo "Site restaurado!"
echo "Backup da versão com problema: backup-pos-falha/"
echo
echo "Acesse novamente o site e atualize a página."
