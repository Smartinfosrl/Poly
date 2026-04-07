# PM Scanner — Setup Completo

## Secrets GitHub (Settings → Secrets → Actions)
| Secret | Valore |
|--------|--------|
| TELEGRAM_BOT_TOKEN | Token bot da @BotFather |
| TELEGRAM_CHAT_ID | -1003644059633 |
| GIST_ID | ID del Gist archivio |
| GIST_TOKEN | Token GitHub con permesso gist |

## Setup Gist (archivio cloud)
1. Vai su gist.github.com
2. Crea Gist con file: archive.json, contenuto: []
3. Tipo: Secret → Create
4. Copia ID dall'URL
5. Crea token su github.com/settings/tokens/new (permesso: gist)
6. Inserisci ID e Token sia nell'app che nei Secrets del repo

## Frequenza scansioni
Ogni 4h automatiche. Logica:
- 04,12,20 Italia → solo CRITICI
- 00,16 Italia → CRITICI + ALLERTA
- 08 Italia → REPORT COMPLETO
