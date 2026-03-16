# 🔍 PM Scanner — GitHub Actions Background Scanner

Scanner automatico con sistema di alert a 3 livelli.

## Come funziona

Lo scanner gira **6 volte al giorno** (ogni 4 ore) e decide automaticamente cosa inviarti in base all'ora italiana:

| Ora Italia | Frequenza | Cosa ricevi | Canale |
|-----------|-----------|-------------|--------|
| 04, 12, 20 | Ogni 4h | Solo **🔴 CRITICI** (score ≥20) | Telegram |
| 00, 16 | Ogni 8h | **🔴 CRITICI + 🟠 ALLERTA** | Telegram |
| 08 | Ogni 24h | **📊 REPORT COMPLETO** (tutto) | Telegram + Email |

Inoltre: se vengono rilevati segnali critici con score ≥20 in qualsiasi momento, ricevi anche un'**email urgente** immediata.

## Setup

### 1. Carica i file nel repo

```
repo/
├── .github/workflows/scan.yml
├── scanner.js
├── index.html (la PWA)
├── manifest.json, sw.js, icons/
```

### 2. Secrets (obbligatorio: Telegram)

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valore | Obbligatorio |
|--------|--------|:---:|
| `TELEGRAM_BOT_TOKEN` | Token del bot da @BotFather | ✅ |
| `TELEGRAM_CHAT_ID` | `-1003644059633` (canale) | ✅ |

### 3. Secrets (opzionale: Email via Resend)

Per ricevere il report giornaliero e gli alert urgenti via email:

1. Registrati su **[resend.com](https://resend.com)** (gratis, 100 email/mese)
2. Crea un'API Key
3. Aggiungi i secrets:

| Secret | Valore |
|--------|--------|
| `RESEND_KEY` | La tua API Key di Resend |
| `EMAIL_TO` | La tua email (es. max@example.com) |

### 4. Attiva GitHub Actions

- Tab **Actions** → abilita workflows
- Test: **Actions → PM Scanner → Run workflow**
  - Puoi scegliere il livello: `critical`, `alert`, o `all`

## Personalizza

### Cambiare frequenza
Modifica il cron in `scan.yml`:
- `'0 */2 * * *'` = ogni 2 ore (12 scan/giorno)
- `'0 */4 * * *'` = ogni 4 ore (6 scan/giorno) ← default
- `'0 */6 * * *'` = ogni 6 ore (4 scan/giorno)

### Cambiare le ore degli alert
Modifica `getAlertTier()` in `scanner.js` per cambiare quali ore ricevono quale livello.

## Limiti
- GitHub Actions free: 2000 min/mese (ogni scan ~1-2 min → ~360 min/mese)
- Repo pubblico: minuti illimitati
- Resend free: 100 email/mese (1 giornaliera + urgenti = ~35/mese)
