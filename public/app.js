// ==============================================================================
// SWAERINGBUNNY - NODE.JS FULL-STACK FRONTEND CLIENT
// Fetches live data from Express REST API endpoints (/api/config, /api/items)
// ==============================================================================

let STORE_CONFIG = null;
let activeCategory = "all";
let searchFilter = "";
let latestProductRequest = 0;

document.addEventListener("DOMContentLoaded", async () => {
  initFilterControls();
  if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) document.getElementById("manageProductsLink").hidden = false;
  await loadStoreConfig();
  await loadProducts();
});

// 1. Fetch store configuration & brand details from Node.js backend
async function loadStoreConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Store settings are unavailable.");
    STORE_CONFIG = await res.json();
    applyBranding(STORE_CONFIG);
    renderTrustBadges(STORE_CONFIG.trustBadges || []);
    renderFaqs(STORE_CONFIG.faqs || []);
  } catch (err) {
    console.error("Could not load /api/config:", err);
  }
}

// 2. Apply brand settings, header links, and social redirects
function applyBranding(config) {
  const currentYear = new Date().getFullYear();
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = currentYear;

  const waUrl = config.contacts.whatsappUrl;
  const igUrl = config.contacts.instagramUrl;

  // Header Nav Links
  const navWa = document.getElementById("navWhatsappBtn");
  if (navWa) navWa.href = waUrl;
  const navIg = document.getElementById("navInstaBtn");
  if (navIg) navIg.href = igUrl;

  // Hero Section Links
  const heroWa = document.getElementById("heroContactWa");
  if (heroWa) heroWa.href = waUrl;
  const heroIg = document.getElementById("heroContactIg");
  if (heroIg) heroIg.href = igUrl;

  // Closing Banner Links
  const closingWa = document.getElementById("closingWaBtn");
  if (closingWa) closingWa.href = waUrl;
  const closingIg = document.getElementById("closingIgBtn");
  if (closingIg) closingIg.href = igUrl;

  // Floating Sticky Buttons
  const floatWa = document.getElementById("floatWaBtn");
  if (floatWa) floatWa.href = waUrl;
  const floatIg = document.getElementById("floatIgBtn");
  if (floatIg) floatIg.href = igUrl;
  const footerIg = document.getElementById("footerIgLink");
  if (footerIg) footerIg.href = igUrl;
}

// 3. Fetch products & services dynamically from Express API
async function loadProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const requestId = ++latestProductRequest;
  grid.setAttribute("aria-busy", "true");

  try {
    let url = `/api/items?category=${encodeURIComponent(activeCategory)}`;
    if (searchFilter) {
      url += `&search=${encodeURIComponent(searchFilter)}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("The catalogue is temporarily unavailable.");
    const data = await res.json();
    if (requestId !== latestProductRequest) return;
    const items = data.items || [];

    // Update count badge
    const countAll = document.getElementById("countAll");
    if (countAll) countAll.textContent = data.catalogTotal ?? data.total;
    const count = data.catalogTotal ?? data.total;
    document.getElementById("catalogueSummary").textContent = count + (count === 1 ? " service" : " services") + " for your games and devices.";

    if (items.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><p>' +
        (searchFilter ? 'No services match <strong>' + escapeHtml(searchFilter) + '</strong>.' : 'No services are available in this category right now.') + '</p></div>';
      return;
    }

    const currency = STORE_CONFIG?.contacts?.currency || "$";

    grid.innerHTML = items
      .map((item) => {
        const imageBanner = item.image
          ? `
          <div class="card-image-wrap">
            <span class="card-badge">${escapeHtml(item.badge)}</span>
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">
          </div>
        `
          : `
          <div class="card-image-wrap card-placeholder">
            <span class="card-badge">${escapeHtml(item.badge)}</span>
            <i class="fa-solid ${escapeHtml(item.icon || "fa-gamepad")}" aria-hidden="true"></i>
          </div>
        `;

        const priceLabel = item.price == null ? "Request a quote" : escapeHtml(currency + item.price);

        const featuresHtml = item.features
          .map(
            (f) => `<li><i class="fa-solid fa-check"></i> <span>${escapeHtml(f)}</span></li>`
          )
          .join("");

        return `
        <article class="game-card">
          ${imageBanner}
          <div class="card-content">
            <div class="card-category-line">
              <span class="card-category">
                ${item.category === "service" ? "⚡ GAMING SERVICE" : "💻 AI / DEVICE SETUP"}
              </span>
            </div>

            <h3 class="card-name">${escapeHtml(item.name)}</h3>
            <div class="card-subtitle">${escapeHtml(item.subtitle)}</div>
            <p class="card-desc">${escapeHtml(item.description)}</p>

            <ul class="card-features">
              ${featuresHtml}
            </ul>
          </div>

          <div class="card-footer">
            <div class="price-box">
              <div class="price-num">${priceLabel}</div>
              <div class="price-billing">${escapeHtml(item.billing)}</div>
            </div>

            <div class="card-actions">
              <a href="${escapeHtml(item.whatsappUrl)}" target="_blank" rel="noopener noreferrer" class="btn-card-wa" title="Order via WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> Order WA
              </a>
              <a href="${escapeHtml(item.instagramUrl)}" target="_blank" rel="noopener noreferrer" class="btn-card-ig" title="DM on Instagram">
                <i class="fa-brands fa-instagram"></i> DM Insta
              </a>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
  } catch (err) {
    if (requestId !== latestProductRequest) return;
    console.error("Could not load products from API:", err);
    grid.innerHTML = '<div class="empty-state"><p>We could not load the services. Please try again.</p><button type="button" class="button button-outline" id="retryProducts">Try again</button></div>';
    document.getElementById("retryProducts").addEventListener("click", loadProducts);
  } finally {
    if (requestId === latestProductRequest) grid.setAttribute("aria-busy", "false");
  }
}

// 4. Filter tabs and search input
function initFilterControls() {
  const tabs = document.querySelectorAll(".filter-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-pressed", "false"); });
      tab.setAttribute("aria-pressed", "true");
      tab.classList.add("active");
      activeCategory = tab.getAttribute("data-filter");
      loadProducts();
    });
  });

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchFilter = e.target.value.trim();
        loadProducts();
      }, 200);
    });
  }
}

// 5. Render Trust Badges from API config
function renderTrustBadges(badges) {
  const container = document.getElementById("trustBadgesGrid");
  if (!container) return;

  container.innerHTML = badges
    .map(
      (b) => `
      <div class="why-card">
        <i class="fa-solid ${b.icon} why-icon"></i>
        <h4>${escapeHtml(b.title)}</h4>
        <p>${escapeHtml(b.desc)}</p>
      </div>
    `
    )
    .join("");
}

// 6. Render FAQ Accordion from API config
function renderFaqs(faqs) {
  const container = document.getElementById("faqAccordion");
  if (!container) return;

  container.innerHTML = faqs
    .map(
      (faq) => `
      <div class="faq-row">
        <button type="button" class="faq-btn" aria-expanded="false">
          <span>${escapeHtml(faq.q)}</span>
          <span class="faq-toggle">+</span>
        </button>
        <div class="faq-desc">
          <p>${escapeHtml(faq.a)}</p>
        </div>
      </div>
    `
    )
    .join("");

  const rows = container.querySelectorAll(".faq-row");
  rows.forEach((row) => {
    const btn = row.querySelector(".faq-btn");
    const desc = row.querySelector(".faq-desc");

    btn.addEventListener("click", () => {
      const isAlreadyActive = row.classList.contains("active");

      // Close all other rows
      rows.forEach((r) => {
        r.classList.remove("active");
        r.querySelector(".faq-btn").setAttribute("aria-expanded", "false");
        r.querySelector(".faq-desc").style.maxHeight = null;
      });

      // Toggle current row
      if (!isAlreadyActive) {
        row.classList.add("active");
        btn.setAttribute("aria-expanded", "true");
        desc.style.maxHeight = desc.scrollHeight + "px";
      }
    });
  });
}

// Helper: Escape HTML strings
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Keep an open storefront current after edits in the product manager.
window.addEventListener("storage", event => { if (event.key === "swearingbunny.catalogue-updated" || event.key === "swaeringbunny.catalogue-updated") loadProducts(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadProducts(); });
window.addEventListener("focus", () => { if (STORE_CONFIG) loadProducts(); });
