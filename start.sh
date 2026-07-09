#!/bin/bash
# Axiom News API — Production Startup (Coolify/Docker)
# DarkWave Studios LLC — Copyright 2026
#
# Wraps server.js in a watchdog that auto-restarts on crash.
# The server contains node-cron jobs that MUST stay alive:
#   - News pipeline scrape (every 6h)
#   - Daily Genesis Block notifications (8 AM)
#   - Blog generation daemon (every 6h)

echo "== Axiom News API Startup =="
echo "== Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

backoff=5

while true; do
    echo "== [AxiomNews] Starting server at $(date -u '+%H:%M:%S UTC')..."
    node server.js
    exit_code=$?
    echo "== [AxiomNews] CRASHED with exit code $exit_code at $(date -u '+%H:%M:%S UTC')"

    if [ $backoff -lt 300 ]; then
        backoff=$((backoff * 2))
    fi
    echo "== [AxiomNews] Restarting in ${backoff}s..."
    sleep $backoff
done
