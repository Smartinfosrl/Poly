# 🔍 PM Scanner — Polymarket Insider Signal Detector

PWA (Progressive Web App) installabile su smartphone che rileva pattern di insider trading su Polymarket.

## 📱 Installazione su Smartphone

### Deploy su GitHub Pages (5 minuti)

1. **Crea un repository GitHub**
   - Vai su [github.com/new](https://github.com/new)
   - Nome: `pm-scanner` (o come preferisci)
   - Pubblico ✅
   - Crea repository

2. **Carica i file**
   ```bash
   git init
   git add .
   git commit -m "PM Scanner PWA"
   git branch -M main
   git remote add origin https://github.com/TUO-USERNAME/pm-scanner.git
   git push -u origin main
   ```
   
   **Oppure** carica manualmente: vai al repo → "Add file" → "Upload files" → trascina tutti i file

3. **Attiva GitHub Pages**
   - Repository → Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` / `/ (root)`
   - Salva
   - Attendi 1-2 minuti

4. **Apri l'URL** (sarà tipo `https://tuo-username.github.io/pm-scanner/`)

5. **Installa l'app** sullo smartphone:
   - **Android**: Chrome mostrerà un banner "Installa" automaticamente, oppure menu ⋮ → "Installa app"
   - **iOS**: Safari → icona condividi ↑ → "Aggiungi a schermata Home"

## 📂 Struttura file

```
pm-scanner/
├── index.html        ← App principale (tutto in un file)
├── manifest.json     ← Configurazione PWA
├── sw.js            ← Service Worker (cache + notifiche)
├── icons/
│   ├── icon-192.png  ← Icona app
│   └── icon-512.png  ← Icona app HD
└── README.md
```

## 🔔 Configurazione Alert

### Browser Push Notifications
- Clicca ON nel pannello 🔔 → il browser chiederà il permesso

### Suono
- Attivo di default, suono diverso per critici vs allerta

### Telegram
1. Apri Telegram → cerca `@BotFather`
2. Invia `/newbot` e segui le istruzioni
3. Copia il **Bot Token** (tipo `123456:ABC-DEF...`)
4. Cerca `@userinfobot` su Telegram → invia `/start` → copia il tuo **Chat ID**
5. Inserisci entrambi nel pannello Alert dell'app

### EmailJS
1. Registrati gratis su [emailjs.com](https://www.emailjs.com/)
2. Email Services → aggiungi Gmail → autorizza
3. Email Templates → crea template con campi:
   - To: `{{to_email}}`
   - Subject: `{{subject}}`
   - Body: `{{message}}`
4. Copia **Public Key** (Account → API Keys), **Service ID**, **Template ID**
5. Inserisci nell'app

## ⚙️ Funzionalità

- **8 tipi di segnali** insider trading
- **Scheduler** personalizzabile (30min → 24h)
- **4 canali alert**: suono, push, Telegram, email
- **Persistenza** impostazioni in localStorage
- **Offline-capable** grazie al Service Worker
- **Mobile-optimized** con safe areas e touch gestures
