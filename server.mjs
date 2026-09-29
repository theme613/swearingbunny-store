import express from 'express';
import cors from 'cors';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import 'dotenv/config';
import { createProductStore } from './lib/catalogue.mjs';
import { mountAdmin } from './lib/admin.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = resolve(__dirname, process.env.DATA_DIR || 'data');
const BRAND_NAME = process.env.BRAND_NAME || 'swearingbunny';
const productStore = createProductStore(resolve(__dirname, process.env.PRODUCTS_FILE || 'data/products.json'));
await productStore.read();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Middleware
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
mountAdmin(app, productStore, __dirname);
app.use(cors());

// Serve static frontend files
app.use(express.static(resolve(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res, path) => {
    if (path.replace(/\\/g, '/').includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// ==============================================================================
// PRODUCT & SERVICE CATALOGUE
// ==============================================================================
async function getCatalogue() {
  const { products } = await productStore.read();
  return products.filter(item => item.active !== false).map(item => ({
    ...item,
    whatsappMsg: item.whatsappMsg || ("Hi " + BRAND_NAME + "! I would like to inquire about " + item.name + (item.price == null ? ". Please send a quote." : "."))
  }));
}

const FAQS = [
  {
    "q": "How do I place an order with swaeringbunny?",
    "a": "Choose a service and click Order WA or DM Insta. Send your game, task list, or device details so we can confirm availability, the scope, and a quote before you book."
  },
  {
    "q": "How much do the services cost?",
    "a": "Pricing depends on the tasks, duration, rank goal, or setup requirements. Request a quote for the service you want; the price is confirmed before booking."
  },
  {
    "q": "Can I book daily help for a game that is not listed?",
    "a": "Yes. Choose Any Game Daily Help and send the game name, platform, and tasks you need. We will confirm whether we can help and discuss a suitable schedule."
  },
  {
    "q": "Does the local AI girlfriend need Wi-Fi?",
    "a": "Offline chatting does not need Wi-Fi once the software and AI model are installed on a compatible computer. An internet connection may be needed for the initial downloads and optional updates."
  },
  {
    "q": "Will CarPlay work on my Android device?",
    "a": "Compatibility depends on your Android head unit or device, iPhone, software, and any required adapter. Send your device model before booking so the setup requirements can be checked."
  },
  {
    "q": "What is included in the GTA mod service?",
    "a": "This service covers GTA single-player mod setup. Share your GTA version and desired mods so compatibility, installation steps, and backup options can be discussed."
  }
];

const TRUST_BADGES = [
  {
    "icon": "fa-gamepad",
    "title": "Daily Help for Your Games",
    "desc": "Choose a listed game or ask about your own daily routine."
  },
  {
    "icon": "fa-sliders",
    "title": "A Plan for Your Goals",
    "desc": "Agree on tasks, setup requirements, and timing before booking."
  },
  {
    "icon": "fa-headset",
    "title": "Direct 1-on-1 Support",
    "desc": "Discuss your service directly on WhatsApp or Instagram."
  },
  {
    "icon": "fa-comment-dollar",
    "title": "Clear Quotes",
    "desc": "Confirm the scope and price before getting started."
  }
];

// Helper: Build WhatsApp Redirect URL
function generateWhatsAppLink(text) {
  let phone = (process.env.WHATSAPP_NUMBER || "601154309279").replace(/[^0-9]/g, "");
  // Automatically convert domestic Malaysian numbers starting with 01 (e.g. 01154309279 -> 601154309279)
  if (phone.startsWith("01")) {
    phone = "60" + phone.slice(1);
  }
  const defaultText = text || `Hello ${BRAND_NAME}! I would like to inquire about your daily game help and setup services.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(defaultText)}`;
}

// Helper: Build Instagram Redirect URL
function generateInstagramLink() {
  const user = (process.env.INSTAGRAM_USERNAME || "swearingbunny").replace("@", "");
  return `https://instagram.com/${user}`;
}

// ==============================================================================
// API ROUTES
// ==============================================================================

// 1. Get Store Configuration & Contacts
app.get('/api/config', (req, res) => {
  res.json({
    brand: {
      name: BRAND_NAME,
      badge: process.env.BRAND_BADGE || "LESS GRIND. MORE GLORY.",
      tagline: process.env.BRAND_TAGLINE || "Your game. Your goals. Next level.",
    },
    contacts: {
      whatsappNumber: process.env.WHATSAPP_NUMBER || "1234567890",
      whatsappUrl: generateWhatsAppLink(),
      instagramUsername: process.env.INSTAGRAM_USERNAME || "swearingbunny",
      instagramUrl: generateInstagramLink(),
      currency: process.env.CURRENCY || "$",
    },
    trustBadges: TRUST_BADGES,
    faqs: FAQS,
  });
});

// 2. Get All Products & Services (with optional category filter)
app.get('/api/items', asyncRoute(async (req, res) => {
  const { category, search } = req.query;
  const catalogue = await getCatalogue();
  let items = [...catalogue];

  if (category && category !== 'all') {
    items = items.filter(item => item.category === category);
  }

  if (typeof search === "string" && search) {
    const q = search.toLowerCase();
    items = items.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }

  // Attach direct WhatsApp and Instagram URLs to each item
  const enriched = items.map(item => ({
    ...item,
    whatsappUrl: generateWhatsAppLink(item.whatsappMsg),
    instagramUrl: generateInstagramLink()
  }));

  res.json({ total: enriched.length, catalogTotal: catalogue.length, items: enriched });
}));

// 3. Get Single Product by ID
app.get('/api/items/:id', asyncRoute(async (req, res) => {
  const item = (await getCatalogue()).find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json({
    ...item,
    whatsappUrl: generateWhatsAppLink(item.whatsappMsg),
    instagramUrl: generateInstagramLink()
  });
}));

// 4. Submit Order Inquiry (logs request & returns instant WhatsApp/Instagram deep links)
app.post('/api/inquire', asyncRoute(async (req, res) => {
  const { itemId, customerName, contactHandle, notes } = req.body;
  const item = (await getCatalogue()).find(i => i.id === itemId);

  const inquiryId = `SB-${randomBytes(4).toString('hex').toUpperCase()}`;
  const record = {
    inquiryId,
    timestamp: new Date().toISOString(),
    item: item ? { id: item.id, name: item.name, price: item.price } : null,
    customerName: customerName || "Guest Gamer",
    contactHandle: contactHandle || "Direct Chat",
    notes: notes || "",
  };

  try {
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(
      resolve(DATA_DIR, 'inquiries.jsonl'),
      JSON.stringify(record) + '\n',
      'utf8'
    );
  } catch (err) {
    console.error("Could not persist inquiry:", err);
  }

  const priceText = item?.price == null
    ? 'please send a quote'
    : (process.env.CURRENCY || '$') + item.price;
  const customWaText = item
    ? 'Hi ' + BRAND_NAME + '! Order Ref [' + inquiryId + ']: I would like to inquire about ' + item.name + ' (' + priceText + '). My handle is ' + (contactHandle || 'none') + '.'
    : 'Hi ' + BRAND_NAME + '! Order Ref [' + inquiryId + ']: I would like to inquire about your services.';

  res.status(201).json({
    success: true,
    inquiryId,
    whatsappUrl: generateWhatsAppLink(customWaText),
    instagramUrl: generateInstagramLink(),
  });
}));

// 5. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    brand: BRAND_NAME
  });
});

// Fallback: Serve index.html for SPA / client routes
app.get('*', (req, res) => {
  res.sendFile(resolve(__dirname, 'public', 'index.html'));
});

// API failures return a readable error without exposing paths or stack traces.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 503;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Could not load or save the catalogue. Please try again." : error.message });
});

// Start Express Server
app.listen(PORT, HOST, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 ${BRAND_NAME} Node.js server running!`);
  console.log(`🔗 Local URL: http://${HOST}:${PORT}`);
  console.log(`📦 Environment: Node.js ${process.version}`);
  console.log(`========================================================\n`);
});
