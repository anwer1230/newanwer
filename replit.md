# Abu_Malk-Services

## Overview
Flask + Socket.IO + Telethon application for managing multiple Telegram accounts:
keyword monitoring, scheduled / rotating sending, advanced auto-join, smart message
sanitizer, automatic replies, alerts, and persistent background tasks.

## Stack
- Python 3.11
- Flask + Flask-SocketIO (server, real-time)
- Telethon (Telegram MTProto client)
- Vanilla JS + Bootstrap 5 RTL frontend (templates/index.html, static/js/app.js)
- Per-user JSON settings stored in `sessions/{user_id}.json`
- Telethon `.session` files stored in `sessions/{user_id}_session.session`

## Key files
- `main.py` — thin wrapper, starts the Flask/SocketIO app on `PORT` (default 5000)
- `app.py` — full backend (~4700 lines): TelegramClientManager, TelegramManager,
  RotatingSendManager, MessageSanitizer, all REST + Socket.IO endpoints
- `templates/index.html` — full SPA UI in Arabic RTL
- `static/js/app.js` — frontend logic for accounts, monitoring, sending, modals
- `sessions/` — per-user settings + Telethon sessions

## Workflow
- `Telegram Bot` runs `python main.py` on port 5000

## Required secrets
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — Telethon credentials (per deployment)
- `SESSION_SECRET` — Flask session signing

## Persistent / always-on tasks
Tasks set their `*_persistent` flag in the user's JSON settings when started, and
clear it when stopped manually. On startup `_auto_resume_persistent_tasks()` re-runs
them automatically:
- `monitoring_persistent` → re-starts `monitoring_worker`
- `rotating_persistent` → re-starts `rotating_manager` with saved messages/groups/interval

Auto-Reply (`auto_reply_enabled`, `auto_replies`) is event-driven inside the running
client and is therefore always-on by design once enabled.

## Key features
- Multi-account dashboard (4 dynamic + user_1/user_2)
- Keyword monitoring with alerts and Saved Messages relay
- Scheduled and rotating sending (with countdown to next send)
- Advanced auto-join with per-link progress, counters (success/already/failed),
  Arabic failure-reason classification, and grouped failure summary
- Smart Sanitizer (smart/always/off) protecting links/phones/handles/ad keywords
- Automatic replies with contains/exact/regex matching and scope (all/private/groups)
- System health endpoint and modal
