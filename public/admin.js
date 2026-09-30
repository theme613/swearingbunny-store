let products = [];
let version = "";
let csrfToken = "";
let selectedId = null;
let dirty = false;
let saving = false;
let currency = "$";
let sessionToken = "";

const form = document.getElementById("productForm");
const field = name => form.elements.namedItem(name);

const imagePreviewImg = document.getElementById("imagePreviewImg");
const imagePreviewPlaceholder = document.getElementById("imagePreviewPlaceholder");
const imageFileInput = document.getElementById("imageFileInput");
const btnUploadImage = document.getElementById("btnUploadImage");
const btnClearImage = document.getElementById("btnClearImage");
const assetPickerSelect = document.getElementById("assetPickerSelect");
const imageUploadStatus = document.getElementById("imageUploadStatus");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function updateImagePreview(url) {
  const clean = (url || "").trim();
  if (clean) {
    if (imagePreviewImg) {
      imagePreviewImg.src = clean;
      imagePreviewImg.style.display = "block";
      imagePreviewImg.onerror = () => {
        imagePreviewImg.style.display = "none";
        if (imagePreviewPlaceholder) {
          imagePreviewPlaceholder.style.display = "flex";
          imagePreviewPlaceholder.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i><span>Image not found</span>';
        }
      };
      imagePreviewImg.onload = () => {
        if (imagePreviewPlaceholder) imagePreviewPlaceholder.style.display = "none";
      };
    }
    if (imagePreviewPlaceholder) imagePreviewPlaceholder.style.display = "none";
  } else {
    if (imagePreviewImg) {
      imagePreviewImg.src = "";
      imagePreviewImg.style.display = "none";
    }
    if (imagePreviewPlaceholder) {
      imagePreviewPlaceholder.style.display = "flex";
      imagePreviewPlaceholder.innerHTML = '<i class="fa-solid fa-image"></i><span>No image</span>';
    }
  }
}

function setImageUploadStatus(msg, type = "") {
  if (!imageUploadStatus) return;
  if (!msg) {
    imageUploadStatus.style.display = "none";
    imageUploadStatus.textContent = "";
    return;
  }
  imageUploadStatus.textContent = msg;
  imageUploadStatus.className = "image-upload-status" + (type ? " " + type : "");
  imageUploadStatus.style.display = "inline-flex";
}

let availableAssets = [];

async function loadAssetsList() {
  if (!assetPickerSelect) return;
  try {
    const headers = {};
    if (sessionToken) headers["X-Admin-Token"] = sessionToken;
    const res = await fetch("/api/admin/assets", { cache: "no-store", headers });
    if (!res.ok) return;
    const data = await res.json();
    availableAssets = data.assets || [];
    
    const nameMap = {
      "assets/genshin.webp": "Genshin Impact (Key Art)",
      "assets/hsr.webp": "Honkai: Star Rail (Key Art)",
      "assets/zzz.webp": "Zenless Zone Zero (Key Art)",
      "assets/valorant.jpg": "Valorant (Sniper Omen Key Art)",
      "assets/valorant_the_arrival.jpg": "Valorant (The Arrival / Team Art)",
      "assets/gta.jpg": "Grand Theft Auto V (Hero Art)",
      "assets/nte.png": "Neverness to Everness (Key Art)",
      "assets/cookierun.jpg": "Cookie Run: Kingdom (Banner Art)",
      "assets/gamepad.jpg": "Any Game (Controller Banner)",
      "assets/aigirlfriend.jpg": "Local AI Companion (Anime Art)",
      "assets/carplay.jpg": "Android CarPlay (Dashboard Art)",
      "assets/apex.jpg": "Apex Legends",
      "assets/league.jpg": "League of Legends",
      "assets/counterstrike.jpg": "Counter-Strike",
      "assets/omen.png": "Gaming Setup (Omen)"
    };

    const currentValue = field("image") ? field("image").value.trim() : "";
    let optionsHtml = '<option value="">-- Choose game art --</option>';
    
    availableAssets.forEach(path => {
      const label = nameMap[path] || path.replace(/^assets\/(uploads\/)?/, "");
      optionsHtml += `<option value="${escapeHtml(path)}">${escapeHtml(label)}</option>`;
    });

    assetPickerSelect.innerHTML = optionsHtml;
    if (currentValue) assetPickerSelect.value = currentValue;
  } catch (err) {
    console.warn("Could not load assets:", err);
  }
}

function status(message, kind = "") {
  const el = document.getElementById("adminStatus");
  if (!el) return;
  el.textContent = message;
  el.className = "admin-status" + (kind ? " " + kind : "");
}

function setDirty(next) {
  dirty = next;
  document.getElementById("editorState").textContent = next ? "Unsaved changes" : "Saved";
}

function canLeave() {
  return !saving && (!dirty || window.confirm("Discard your unsaved changes?"));
}

function renderList() {
  const query = document.getElementById("adminSearch").value.trim().toLowerCase();
  const visible = products.filter(product => product.name.toLowerCase().includes(query));
  document.getElementById("productCount").textContent = products.length;
  document.getElementById("adminProductList").innerHTML = visible.map(product => `
    <button type="button" class="product-list-button ${selectedId === product.id ? "selected" : ""}" data-id="${escapeHtml(product.id)}" aria-pressed="${selectedId === product.id}">
      <strong>${escapeHtml(product.name)}</strong>
      <span class="product-list-meta"><span class="visibility-chip ${product.active === false ? "is-hidden" : ""}">${product.active === false ? "Hidden" : "Visible"}</span><span>${product.price == null ? "By quote" : escapeHtml(currency + product.price)}</span></span>
    </button>`).join("") || '<p class="list-empty">No products found. Add a product to get started.</p>';
  document.querySelectorAll(".product-list-button").forEach(button => button.addEventListener("click", () => {
    if (canLeave()) selectProduct(button.dataset.id);
  }));
}

function selectProduct(id) {
  selectedId = id;
  const product = products.find(item => item.id === id);
  const isNew = !product;
  const draft = product || { name: "", category: "service", badge: "NEW", subtitle: "", price: null, billing: "", description: "", features: [], image: "", icon: "fa-gamepad", active: true, whatsappMsg: "" };
  form.hidden = false;
  document.getElementById("editorEmpty").hidden = true;
  document.getElementById("editorTitle").textContent = isNew ? "Add a product" : "Edit product";
  for (const name of ["name", "category", "badge", "subtitle", "billing", "description", "image", "icon", "whatsappMsg"]) {
    field(name).value = draft[name] || "";
  }
  field("price").value = draft.price ?? "";
  field("features").value = draft.features.join("\n");
  field("active").checked = draft.active !== false;
  document.getElementById("productId").value = draft.id || "Assigned when saved";
  document.getElementById("deleteProduct").hidden = isNew;
  updateImagePreview(draft.image || "");
  if (assetPickerSelect) {
    assetPickerSelect.value = draft.image || "";
  }
  setImageUploadStatus("");
  const index = products.findIndex(item => item.id === id);
  document.getElementById("moveUp").disabled = isNew || index <= 0;
  document.getElementById("moveDown").disabled = isNew || index === products.length - 1;
  setDirty(false);
  renderList();
}

function newId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "product";
  return slug + "-" + crypto.randomUUID().slice(0, 8);
}

function draftProduct() {
  const value = name => field(name).value.trim();
  const price = value("price") === "" ? null : Number(value("price"));
  return {
    id: selectedId || newId(value("name")), name: value("name"), category: value("category"),
    badge: value("badge"), subtitle: value("subtitle"), price,
    billing: value("billing") || (price === null ? "price confirmed before booking" : "starting rate"),
    description: value("description"), features: value("features").split("\n").map(line => line.trim()).filter(Boolean),
    image: value("image"), icon: value("icon") || "fa-gamepad", active: field("active").checked,
    whatsappMsg: value("whatsappMsg")
  };
}

async function persist(nextProducts, nextId, message) {
  if (saving) return;
  saving = true;
  const controls = Array.from(document.querySelectorAll("main button, main input, main select, main textarea"));
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  status("Saving changes…");
  let succeeded = false;
  try {
    const headers = { 
      "Content-Type": "application/json", 
      "X-CSRF-Token": csrfToken 
    };
    if (sessionToken) headers["X-Admin-Token"] = sessionToken;

    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers,
      body: JSON.stringify({ products: nextProducts, version })
    });

    if (response.status === 401) {
      showLoginModal("Session expired. Please log in again.");
      throw new Error("Authentication required.");
    }

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The product could not be saved.");
    products = result.products;
    version = result.version;
    csrfToken = result.csrfToken;
    selectedId = nextId;
    setDirty(false);
    try { localStorage.setItem("swearingbunny.catalogue-updated", String(Date.now())); } catch { /* Store refreshes when focused. */ }
    status(message, "success");
    succeeded = true;
  } catch (error) {
    status(error.message, "error");
  } finally {
    saving = false;
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
  }
  if (succeeded) {
    if (selectedId) selectProduct(selectedId);
    else {
      form.hidden = true;
      document.getElementById("editorEmpty").hidden = false;
      renderList();
    }
  }
}

form.addEventListener("input", () => setDirty(true));

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const draft = draftProduct();
  const next = selectedId ? products.map(product => product.id === selectedId ? draft : product) : [...products, draft];
  persist(next, draft.id, "Product saved. Your store is up to date.");
});

document.getElementById("addProduct").addEventListener("click", () => {
  if (!canLeave()) return;
  selectProduct(null);
  field("name").focus();
});

document.getElementById("resetProduct").addEventListener("click", () => {
  if (canLeave()) selectProduct(selectedId);
});

document.getElementById("adminSearch").addEventListener("input", renderList);

document.getElementById("deleteProduct").addEventListener("click", () => {
  const product = products.find(item => item.id === selectedId);
  if (!product || saving || !window.confirm('Delete "' + product.name + '"? You can hide it instead by turning off visibility.')) return;
  const remaining = products.filter(item => item.id !== selectedId);
  persist(remaining, remaining[0]?.id || null, "Product deleted. Your store is up to date.");
});

function moveProduct(direction) {
  if (!canLeave()) return;
  const index = products.findIndex(product => product.id === selectedId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= products.length) return;
  const next = [...products];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  persist(next, selectedId, "Display order saved.");
}

document.getElementById("moveUp").addEventListener("click", () => moveProduct(-1));
document.getElementById("moveDown").addEventListener("click", () => moveProduct(1));

window.addEventListener("beforeunload", event => {
  if (dirty || saving) { event.preventDefault(); event.returnValue = ""; }
});

// Image Manager & Upload Listeners
if (field("image")) {
  field("image").addEventListener("input", () => {
    const val = field("image").value.trim();
    updateImagePreview(val);
    if (assetPickerSelect) assetPickerSelect.value = val;
  });
}

if (assetPickerSelect) {
  assetPickerSelect.addEventListener("change", () => {
    const val = assetPickerSelect.value;
    if (field("image")) {
      field("image").value = val;
      updateImagePreview(val);
      setDirty(true);
    }
  });
}

if (btnUploadImage && imageFileInput) {
  btnUploadImage.addEventListener("click", () => {
    imageFileInput.value = "";
    imageFileInput.click();
  });

  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageUploadStatus("Please choose an image file (PNG, JPG, WEBP, GIF, SVG).", "error");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setImageUploadStatus("File is too large. Maximum size is 15MB.", "error");
      return;
    }

    const originalBtnHtml = btnUploadImage.innerHTML;
    btnUploadImage.disabled = true;
    btnUploadImage.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
    setImageUploadStatus("Reading and uploading image…", "loading");

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });

      const headers = { "Content-Type": "application/json" };
      if (sessionToken) headers["X-Admin-Token"] = sessionToken;

      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: file.name, data: dataUrl })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload image.");

      if (field("image")) {
        field("image").value = data.url;
        updateImagePreview(data.url);
        setDirty(true);
      }

      setImageUploadStatus("Image uploaded successfully!", "success");
      await loadAssetsList();
      if (assetPickerSelect) assetPickerSelect.value = data.url;
    } catch (err) {
      setImageUploadStatus(err.message, "error");
    } finally {
      btnUploadImage.disabled = false;
      btnUploadImage.innerHTML = originalBtnHtml;
    }
  });
}

if (btnClearImage) {
  btnClearImage.addEventListener("click", () => {
    if (field("image")) {
      field("image").value = "";
      updateImagePreview("");
      if (assetPickerSelect) assetPickerSelect.value = "";
      setDirty(true);
      setImageUploadStatus("");
    }
  });
}

// ==============================================================================
// AUTHENTICATION & LOGIN LOGIC
// ==============================================================================
const loginOverlay = document.getElementById("adminLoginOverlay");
const loginForm = document.getElementById("adminLoginForm");
const loginErrorMsg = document.getElementById("loginErrorMsg");
const passwordInput = document.getElementById("adminPasswordInput");
const togglePwBtn = document.getElementById("togglePasswordVisibility");
const logoutBtn = document.getElementById("adminLogoutBtn");

function showLoginModal(errorMessage = "") {
  if (loginOverlay) loginOverlay.style.display = "flex";
  if (logoutBtn) logoutBtn.style.display = "none";
  if (loginErrorMsg) {
    if (errorMessage) {
      loginErrorMsg.textContent = errorMessage;
      loginErrorMsg.style.display = "block";
    } else {
      loginErrorMsg.style.display = "none";
    }
  }
  if (passwordInput) {
    passwordInput.value = "";
    setTimeout(() => passwordInput.focus(), 100);
  }
}

function hideLoginModal() {
  if (loginOverlay) loginOverlay.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (loginErrorMsg) loginErrorMsg.style.display = "none";
}

if (togglePwBtn && passwordInput) {
  togglePwBtn.addEventListener("click", () => {
    const isPw = passwordInput.type === "password";
    passwordInput.type = isPw ? "text" : "password";
    togglePwBtn.querySelector("i").className = isPw ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) return;

    const submitBtn = document.getElementById("adminLoginSubmit");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…';

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Incorrect password.");
      }

      sessionToken = data.token || "";
      csrfToken = data.csrfToken || "";
      hideLoginModal();
      await loadManager();
    } catch (err) {
      loginErrorMsg.textContent = err.message;
      loginErrorMsg.style.display = "block";
      passwordInput.select();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Unlock Dashboard';
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (!canLeave()) return;
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout error:", err);
    }
    sessionToken = "";
    products = [];
    renderList();
    showLoginModal("You have been logged out.");
  });
}

// ==============================================================================
// INITIAL LOAD & SESSION CHECK
// ==============================================================================
async function loadManager() {
  try {
    const headers = {};
    if (sessionToken) headers["X-Admin-Token"] = sessionToken;

    const response = await fetch("/api/admin/products", { 
      cache: "no-store",
      headers 
    });

    if (response.status === 401) {
      showLoginModal();
      return;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load the product manager.");
    
    hideLoginModal();
    products = data.products; 
    version = data.version; 
    csrfToken = data.csrfToken;

    try {
      const config = await (await fetch("/api/config")).json();
      currency = config.contacts?.currency || "$";
      document.getElementById("currencyLabel").textContent = currency;
    } catch { /* Default currency remains available. */ }

    document.getElementById("addProduct").disabled = false;
    await loadAssetsList();
    renderList();
    if (products.length) selectProduct(products[0].id);
    status("Ready to edit. Select a product or add a new one.");
  } catch (error) {
    status(error.message, "error");
  }
}

// Initial authentication check
async function checkAuthAndInit() {
  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    const data = await res.json();
    if (!data.authenticated) {
      showLoginModal();
    } else {
      hideLoginModal();
      await loadManager();
    }
  } catch {
    showLoginModal();
  }
}

checkAuthAndInit();
