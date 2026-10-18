#!/usr/bin/env bash
# Cadangan harian (cron): simpan 14 hari terakhir. Berisi data pribadi → folder khusus, izin 700.
set -euo pipefail
cd /srv/udakids
mkdir -p /srv/backups && chmod 700 /srv/backups
pnpm --silent db:backup "/srv/backups/udakids-$(date +%F).dump"
find /srv/backups -name 'udakids-*.dump' -mtime +14 -delete
