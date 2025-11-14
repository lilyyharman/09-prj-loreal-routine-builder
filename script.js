/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* selection state cache */
let productsCache = null;
const selectedProducts = new Set();

// Conversation history stored in Chat Completions format and persisted
let conversationMessages = [];

// Persisted selection helpers
function saveSelected() {
  try {
    const arr = Array.from(selectedProducts);
    localStorage.setItem("selectedProducts", JSON.stringify(arr));
  } catch (e) {
    console.warn("saveSelected error", e);
  }
}

function loadSelected() {
  try {
    const raw = localStorage.getItem("selectedProducts");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => selectedProducts.add(Number(id)));
      }
    }
  } catch (e) {
    console.warn("loadSelected error", e);
  }
}

function loadConversation() {
  try {
    const raw = localStorage.getItem("conversationMessages");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) conversationMessages = parsed;
    }
  } catch (e) {
    console.warn("loadConversation error", e);
    conversationMessages = [];
  }
}

function saveConversation() {
  try {
    localStorage.setItem(
      "conversationMessages",
      JSON.stringify(conversationMessages)
    );
    console.debug("conversationMessages saved", conversationMessages);
  } catch (e) {
    console.warn("saveConversation error", e);
  }
}

loadConversation();
// load persisted product selections and render the Selected Products panel
loadSelected();
renderSelectedProducts();

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (productsCache) return productsCache;
  const response = await fetch("products.json");
  const data = await response.json();
  productsCache = data.products;
  return productsCache;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.has(product.id);
      return `
    <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        product.id
      }">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="toggle-desc" type="button" aria-expanded="false">Details</button>
      </div>
    </div>
  `;
    })
    .join("");
}

/* Event delegation: toggle product selection when a card is clicked */
productsContainer.addEventListener("click", async (e) => {
  // Handle Details button: open modal in center with backdrop
  const toggle = e.target.closest(".toggle-desc");
  if (toggle && productsContainer.contains(toggle)) {
    const card = toggle.closest(".product-card");
    const id = Number(card.dataset.id);
    const products = await loadProducts();
    const product = products.find((p) => p.id === id);
    if (product) openDetailsModal(product, toggle);
    return;
  }

  // Otherwise toggle selection when clicking the card
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.dataset.id);

  if (selectedProducts.has(id)) {
    selectedProducts.delete(id);
    card.classList.remove("selected");
  } else {
    selectedProducts.add(id);
    card.classList.add("selected");
  }

  renderSelectedProducts();
  saveSelected();
});

// Create and open centered modal with backdrop
function openDetailsModal(product, triggerBtn) {
  // prevent multiple modals
  closeDetailsModal();

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", product.name + " details");

  modal.innerHTML = `
    <div class="modal-inner">
      <h3>${product.name}</h3>
      <div class="modal-brand">${product.brand}</div>
      <div class="modal-desc">${product.description}</div>
      <div class="modal-actions"><button class="modal-close">Close</button></div>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // store for close
  document.body._currentModal = { backdrop, triggerBtn };

  // focus management
  const closeBtn = modal.querySelector(".modal-close");
  closeBtn.focus();

  // handlers
  closeBtn.addEventListener("click", closeDetailsModal);
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) closeDetailsModal();
  });

  document.addEventListener("keydown", escKeyHandler);
}

function escKeyHandler(e) {
  if (e.key === "Escape") closeDetailsModal();
}

function closeDetailsModal() {
  const info = document.body._currentModal;
  if (!info) return;
  const { backdrop, triggerBtn } = info;
  if (backdrop && backdrop.parentNode)
    backdrop.parentNode.removeChild(backdrop);
  delete document.body._currentModal;
  document.removeEventListener("keydown", escKeyHandler);
  if (triggerBtn && typeof triggerBtn.focus === "function") triggerBtn.focus();
}

/* Render the Selected Products panel based on the selection set */
async function renderSelectedProducts() {
  const products = await loadProducts();
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet.</p>`;
    return;
  }

  const items = Array.from(selectedProducts)
    .map((id) => {
      const p = products.find((prod) => prod.id === id);
      if (!p) return "";
      return `
      <div class="selected-item" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <div class="sel-info">
          <strong>${p.name}</strong>
          <div class="brand">${p.brand}</div>
        </div>
        <button class="remove-item" aria-label="Remove ${p.name}">&times;</button>
      </div>
    `;
    })
    .join("");
  // add a small clear-all control above the list
  selectedProductsList.innerHTML = `
    <div class="selected-actions"><button id="clearSelections" class="clear-btn" type="button">Clear All</button></div>
    ${items}
  `;
}

/* Allow removing items by clicking the remove button in the selected list */
selectedProductsList.addEventListener("click", (e) => {
  const clearBtn = e.target.closest("#clearSelections");
  if (clearBtn) {
    // clear all selections
    selectedProducts.clear();
    saveSelected();
    renderSelectedProducts();
    // unmark any visible cards
    productsContainer
      .querySelectorAll(".product-card.selected")
      .forEach((c) => c.classList.remove("selected"));
    return;
  }

  const btn = e.target.closest(".remove-item");
  if (!btn) return;
  const item = btn.closest(".selected-item");
  const id = Number(item.dataset.id);
  selectedProducts.delete(id);

  // update UI: remove from selected list and unmark card if visible
  renderSelectedProducts();
  saveSelected();
  const card = productsContainer.querySelector(`[data-id='${id}']`);
  if (card) card.classList.remove("selected");
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  // when category changes, update the displayed products considering search
  updateProductDisplay();
});

// debounce helper to avoid too many renders while typing
function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function updateProductDisplay() {
  const products = await loadProducts();
  const selectedCategory = categoryFilter ? categoryFilter.value : "";
  const query =
    productSearch && productSearch.value
      ? String(productSearch.value).trim().toLowerCase()
      : "";

  let results = products;

  if (selectedCategory) {
    results = results.filter((p) => p.category === selectedCategory);
  }

  if (query) {
    // filter by name, brand, description or category keywords
    results = results.filter((p) => {
      const hay =
        `${p.name} ${p.brand} ${p.description} ${p.category}`.toLowerCase();
      return hay.includes(query);
    });
  }

  // If no filters active, show the placeholder (same UX as before)
  if (!selectedCategory && !query) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  displayProducts(results);
}

// wire search input with debounce
if (productSearch) {
  productSearch.addEventListener(
    "input",
    debounce(() => updateProductDisplay(), 200)
  );
}

/* Chat form submission handler - sends user message to worker for reply */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput && userInput.value ? userInput.value.trim() : "";
  if (!text) return;

  // ensure a system prompt exists in the conversation
  if (!conversationMessages || conversationMessages.length === 0) {
    conversationMessages = [
      {
        role: "system",
        content:
          "You are a helpful beauty assistant. Answer user questions about products, routines, and usage clearly and concisely.",
      },
    ];
  }

  // append the new user message and persist
  const userMsg = { role: "user", content: String(text) };
  conversationMessages.push(userMsg);
  saveConversation();

  // show user message and a loading note
  chatWindow.innerHTML = `<div class="user-message"><strong>You:</strong> ${escapeHtml(
    text
  )}</div><div class="placeholder-message">Connecting to assistant…</div>`;

  try {
    if (typeof WORKER_URL === "undefined" || !WORKER_URL) {
      throw new Error(
        "No WORKER_URL found. Add WORKER_URL to secrets.js (e.g. const WORKER_URL = 'https://your-worker.example.com/')"
      );
    }

    // send both the new `messages` array and the legacy `chat` shape for backward compatibility
    // include the last assistant message (if any) inside `chat.message` so older worker code gets context
    const lastAssistant = (() => {
      for (let i = conversationMessages.length - 1; i >= 0; i--) {
        if (conversationMessages[i].role === "assistant")
          return String(conversationMessages[i].content || "");
      }
      return "";
    })();

    const legacyChatMessage = lastAssistant
      ? lastAssistant + "\n\nUser: " + text
      : text;
    const outgoingPayload = {
      messages: conversationMessages,
      chat: { message: legacyChatMessage },
    };
    console.debug("sending payload to worker", outgoingPayload);

    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(outgoingPayload),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Worker error: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    const aiText =
      data.content ||
      data.text ||
      (typeof data === "string" ? data : JSON.stringify(data));

    // append assistant reply and persist
    conversationMessages.push({ role: "assistant", content: String(aiText) });
    saveConversation();

    chatWindow.innerHTML = `<div class="user-message"><strong>You:</strong> ${escapeHtml(
      text
    )}</div><div class="ai-message">${escapeHtml(aiText).replace(
      /\n/g,
      "<br>"
    )}</div>`;
    if (userInput) userInput.value = "";
  } catch (err) {
    console.error(err);
    chatWindow.innerHTML = `<div class="placeholder-message">Error: ${escapeHtml(
      err.message || String(err)
    )}</div>`;
  }
});

/* Generate Routine button: collect selected products and call OpenAI */
generateRoutineBtn.addEventListener("click", async () => {
  // basic UI feedback
  if (selectedProducts.size === 0) {
    chatWindow.innerHTML = `<div class="placeholder-message">Please select at least one product to generate a routine.</div>`;
    return;
  }

  chatWindow.innerHTML = `<div class="placeholder-message">Generating personalized routine…</div>`;

  try {
    const products = await loadProducts();
    const selected = Array.from(selectedProducts)
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
      }));

    // build messages for the Chat Completions API
    const systemMessage = {
      role: "system",
      content:
        "You are an expert beauty advisor. Given a list of products with name, brand, category and description, produce a clear, step-by-step routine that uses these products. Keep steps short and practical, include order of use and any timing or cautions. Output plain text suitable for display in a chat window.",
    };

    const userMessage = {
      role: "user",
      content: `Selected products:\n${JSON.stringify(selected, null, 2)}`,
    };

    const payload = {
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
      max_tokens: 800,
      temperature: 0.7,
    };

    // Prefer calling a server/worker so the OpenAI API key stays server-side.
    if (typeof WORKER_URL === "undefined" || !WORKER_URL) {
      throw new Error(
        "No WORKER_URL found. Add WORKER_URL to secrets.js (e.g. const WORKER_URL = 'https://your-worker.example.com/generate-routine')"
      );
    }

    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Worker error: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    // support a few possible worker response shapes
    let aiText = "(No response from worker)";
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      aiText = data.choices[0].message.content;
    } else if (data.content) {
      aiText = data.content;
    } else if (data.text) {
      aiText = data.text;
    } else if (typeof data === "string") {
      aiText = data;
    }

    // Persist the generated routine into conversationMessages so follow-ups reference it
    conversationMessages = [
      systemMessage,
      userMessage,
      { role: "assistant", content: String(aiText) },
    ];
    saveConversation();

    chatWindow.innerHTML = `<div class="ai-message">${escapeHtml(
      aiText
    ).replace(/\n/g, "<br>")}</div>`;
  } catch (err) {
    console.error(err);
    chatWindow.innerHTML = `<div class="placeholder-message">Error generating routine: ${escapeHtml(
      err.message || String(err)
    )}</div>`;
  }
});

// small helper to escape HTML before inserting AI text
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
