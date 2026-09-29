#!/usr/bin/env bash
# Déploie la landing sur l'hébergement OVH par FTP (TLS si dispo).
# Le mot de passe est demandé au lancement, jamais stocké.
#
#   ./deploy.sh              -> envoie dans www/ (racine web OVH)
#   REMOTE_DIR=autre ./deploy.sh
set -euo pipefail

HOST="ftp.cluster129.hosting.ovh.net"
FTP_USER="${FTP_USER:-wuutifn}"
REMOTE_DIR="${REMOTE_DIR:-www}"   # relatif au home /homez.956/wuutifn

cd "$(dirname "$0")"

read -rsp "Mot de passe FTP pour ${FTP_USER}@${HOST} : " FTP_PASS
echo

# Fichiers du site (+ .htaccess, robots, sitemap), sans les fichiers de travail (.claude, .DS_Store, ce script)
FILES=(index.html mentions-legales.html confidentialite.html styles.css main.js i18n.js robots.txt sitemap.xml llms.txt .htaccess)
while IFS= read -r f; do FILES+=("$f"); done < <(find assets locales -type f ! -name ".DS_Store" | sort)

echo "Envoi de ${#FILES[@]} fichiers vers ${HOST}/${REMOTE_DIR}/"
for f in "${FILES[@]}"; do
  printf '  %s\n' "$f"
  curl --silent --show-error --fail \
    --ssl --ftp-create-dirs \
    --user "${FTP_USER}:${FTP_PASS}" \
    -T "$f" "ftp://${HOST}/${REMOTE_DIR}/${f}"
done

unset FTP_PASS
echo "Terminé."
