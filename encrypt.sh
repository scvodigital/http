#!/bin/bash
echo -e "\nUpdating secrets.tar file with secret files"
tar cf secrets.tar src/config.ts app-engine-service-account.json
echo "Using Travis to encrypt secrets file"
ENCLINE="$(travis encrypt-file --no-interactive -f secrets.tar | grep -E 'openssl.*')"
echo -e "Now make sure the first 'before_install' task in '.travis.yml' is equal to the following\n\n  - ${ENCLINE}\n"