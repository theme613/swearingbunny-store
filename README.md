# swaeringbunny — Node.js & Express Gaming Storefront 🎮⚡

Full-stack Node.js application for **swaeringbunny** showcasing daily game help, Valorant rank boosting, GTA single-player mods, offline AI girlfriend setup, and Android CarPlay for iPhone with automated redirection to **WhatsApp** and **Instagram**.

---

## 🚀 Quick Start (Node.js & NPM)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
- **Development Mode** (with auto-reload on file edits):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

Your server will be live at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ⚙️ Configuration (`.env`)

Configure your WhatsApp phone number, Instagram username, and server port directly in [`.env`](.env):

```env
PORT=3000
HOST=127.0.0.1

# Brand Details
BRAND_NAME=swaeringbunny
BRAND_BADGE=LESS GRIND. MORE GLORY.
BRAND_TAGLINE=Your game. Your goals. Next level.

# Direct Redirect Contacts
WHATSAPP_NUMBER=1234567890         # <-- Enter your phone number with country code (e.g. 628123456789)
INSTAGRAM_USERNAME=swearingbunny   # <-- Your Instagram handle

CURRENCY=$
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/config` | Returns store branding, contacts, and active social links |
| `GET` | `/api/items` | Returns all gaming services & apps (supports `?category=service|app` & `?search=...`) |
| `GET` | `/api/items/:id` | Returns a specific service or software item |
| `POST` | `/api/inquire` | Logs an inquiry into `data/inquiries.jsonl` and returns custom WhatsApp & Instagram URLs |
| `GET` | `/api/health` | Server status and uptime |

---

## 📁 Project Structure

```text
website/
├── .env                  # Environment variables (WhatsApp number, Instagram, port)
├── .env.example          # Template for environment configuration
├── package.json          # Node.js dependencies and run scripts
├── server.mjs            # Express REST API backend and static file server
├── data/                 # Inquiries and customer request logs
└── public/               # Client-side web application
    ├── assets/           # High-res game graphics (omen.png, valorant.png, etc.)
    ├── index.html        # Modern Space Grotesk / Inter HTML layout
    ├── style.css         # Base layout (theme.css provides dark and white themes)
    └── app.js            # Client-side JS consuming backend REST API
```

## Product editing and themes

Open **http://localhost:3000/admin** to manage products in your browser. See [EDIT_PRODUCTS.md](EDIT_PRODUCTS.md) for prices, images, visibility, ordering, and backup recovery. Changes are saved to `data/products.json` without restarting the server. The manager is available only on the server computer through localhost.

The **Light mode / Dark mode** button switches the entire store and manager, and remembers your choice. Shared theme colors live in `public/theme.css`.

## Service catalogue

1. Genshin Daily Help
2. Honkai Star Rail Daily Help
3. Valorant Rank Boosting Service
4. Zenless Zone Zero Daily Help
5. GTA Single Player Mod
6. NTE Daily Help
7. Cookie Kingdom Daily Help
8. Any Game Daily Help
9. Local AI Girlfriend Setup (No Wi-Fi Needed)
10. Android Device CarPlay for iPhone

Prices are confirmed by quote. The API returns `price: null` until a price is configured. The storefront name is `swaeringbunny`; the Instagram contact remains configurable with `INSTAGRAM_USERNAME`.
