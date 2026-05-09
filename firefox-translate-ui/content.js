/* ============================================================
   content.js — Firefox Yerel Çeviri Eklentisi (v7.0)
   - Akıllı Viewport Öncelikli Kuyruk
   - Bulanık Maskeleme (Piksel Yüksekliği Koruması)
   - Satır İçi (Inline) Etiket Gruplama
   - Tam CSS Kalıtımı (Body-Child Architecture)
   ============================================================ */

let isExtensionEnabled = false;
let isTranslating = false;

// Sadece o an gözümüzün önünde olan elementleri tutan küme
const visibleSet = new Set();  

let observer = null;
const originalTextsMap = new Map();
let totalTranslatable = 0;
let totalTranslated = 0;

let tooltipEl = null;
let statusEl = null;
let rightPanelEl = null;

// ──────────────────────────────────────────────────────────────
// 0. Arka Plandan Gelen Sinyali Dinle
// ──────────────────────────────────────────────────────────────
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggle") {
    isExtensionEnabled = !isExtensionEnabled;

    if (isExtensionEnabled) {
      console.log("[TGemma] Eklenti açıldı. Bölünme başlatılıyor...");
      startTranslation();
    } else {
      if (confirm("Çeviriyi durdurmak ve orijinal görünüme dönmek için sayfa yenilenecek. Onaylıyor musunuz?")) {
        window.location.reload();
        return;
      } else {
        isExtensionEnabled = true;
      }
    }
    sendResponse({ state: isExtensionEnabled });
  }
});

function startTranslation() {
  wrapAndTagLooseTextNodes(document.body); // 1. Serbest metinleri grupla
  tagLeftPanelElements();                  // 2. Blok metinleri etiketle
  createRightPanel();                      // 3. Sağ paneli oluştur
  injectReflowStyles();                    // 4. CSS ile ekranı böl
  setupLeftPanelLayout();                  
  syncRightPanelTheme();                   
  createTooltipElement();
  createStatusElement();
  observeRightPanelElements();             // 5. Kaydırma takibi başlat
  setupHoverSync();
  setupScrollSync();
}

// ──────────────────────────────────────────────────────────────
// 1. Serbest Metin ve Satır İçi (Inline) Etiket Gruplama
// (Fotoğraftaki <font>, <b> gibi etiketleri metinle birlikte paketler)
// ──────────────────────────────────────────────────────────────
function wrapAndTagLooseTextNodes(container) {
  let uniqueIdCounter = 10000;
  const blockTags = new Set([
    "DIV", "SECTION", "ARTICLE", "LI", "BLOCKQUOTE", "TD", "TH", "DD", "DT",
    "BODY", "MAIN", "FORM", "HEADER", "FOOTER", "NAV", "ASIDE", "HR",
    "P", "H1", "H2", "H3", "H4", "H5", "H6", "FIGURE", "TABLE", "UL", "OL", "DL"
  ]);

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
  const blocks = [];
  if (blockTags.has(container.tagName)) blocks.push(container);
  while (walker.nextNode()) {
    if (blockTags.has(walker.currentNode.tagName)) blocks.push(walker.currentNode);
  }

  blocks.forEach(block => {
    if (block.closest("pre, code, script, style, noscript, textarea")) return;

    let currentGroup = [];
    let hasText = false;
    const children = Array.from(block.childNodes);

    children.forEach(child => {
      const isBlock = child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.tagName);

      if (!isBlock && child.nodeType !== Node.COMMENT_NODE) {
        currentGroup.push(child);
        if (child.nodeType === Node.TEXT_NODE && /[a-zA-Z]/.test(child.textContent)) {
          hasText = true;
        }
      } else {
        // Blok elementi geldi, biriken grubu paketle
        if (currentGroup.length > 0 && hasText) {
          wrapGroup(currentGroup, block, ++uniqueIdCounter);
        }
        currentGroup = [];
        hasText = false;
      }
    });

    // Sonda kalanları paketle
    if (currentGroup.length > 0 && hasText) {
      wrapGroup(currentGroup, block, ++uniqueIdCounter);
    }
  });
}

function wrapGroup(group, parent, idCounter) {
  const span = document.createElement("span");
  span.className = "tgemma-wrapped";
  span.dataset.tgemmaId = "zw-" + idCounter;
  parent.insertBefore(span, group[0]);
  group.forEach(node => span.appendChild(node));
}

// ──────────────────────────────────────────────────────────────
// 2. Blok Elementleri Etiketleme
// ──────────────────────────────────────────────────────────────
function tagLeftPanelElements() {
  let uniqueIdCounter = 0;
  const blockSelectors = "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, figcaption, dt, dd, label, summary, address";

  const elementsToTranslate = document.body.querySelectorAll(blockSelectors);
  elementsToTranslate.forEach((el) => {
    if (el.dataset.tgemmaId) return; // Wrap fonksiyonu eklediyse atla
    if (el.closest("pre, code, script, style, noscript, textarea")) return;
    
    if (el.querySelectorAll(blockSelectors).length === 0) {
      const text = el.textContent.trim();
      if (text.length > 1 && /[a-zA-Z]/.test(text)) {
        uniqueIdCounter++;
        el.dataset.tgemmaId = "z-" + uniqueIdCounter;
      }
    }
  });
}

// ──────────────────────────────────────────────────────────────
// 3. Sağ Paneli Klonlama ve Bulanıklaştırma
// ──────────────────────────────────────────────────────────────
function createRightPanel() {
  if (document.getElementById("tgemma-right-panel")) return;

  rightPanelEl = document.createElement("div");
  rightPanelEl.id = "tgemma-right-panel";

  const clonedFragment = document.createDocumentFragment();
  Array.from(document.body.childNodes).forEach((child) => {
    if (child.id !== "tgemma-right-panel" && child.id !== "tgemma-tooltip" && child.id !== "tgemma-status") {
      clonedFragment.appendChild(child.cloneNode(true));
    }
  });
  rightPanelEl.appendChild(clonedFragment);
  rightPanelEl.querySelectorAll("script").forEach((s) => s.remove());

  const taggedInClone = rightPanelEl.querySelectorAll("[data-tgemma-id]");
  taggedInClone.forEach((cloneEl) => {
    const tgemmaId = cloneEl.dataset.tgemmaId;
    const text = cloneEl.textContent.trim();

    if (text.length > 1 && /[a-zA-Z]/.test(text)) {
      originalTextsMap.set(tgemmaId, { html: cloneEl.innerHTML, text: text });
      
      cloneEl.classList.add("tgemma-pending");
      totalTranslatable++;
    } else {
      delete cloneEl.dataset.tgemmaId;
    }
  });

  document.body.appendChild(rightPanelEl);
}

// ──────────────────────────────────────────────────────────────
// 4. CSS Düzenleri (Reflow & Theme)
// ──────────────────────────────────────────────────────────────
function syncRightPanelTheme() {
  if (!rightPanelEl) return;
  const bodyStyle = window.getComputedStyle(document.body);
  const htmlStyle = window.getComputedStyle(document.documentElement);
  
  let bg = bodyStyle.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = htmlStyle.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = "#ffffff"; 

  rightPanelEl.style.backgroundColor = bg;
}

function injectReflowStyles() {
  if (document.getElementById("tgemma-reflow-style")) return;
  const style = document.createElement("style");
  style.id = "tgemma-reflow-style";
  
  style.textContent = `
    body.tgemma-split {
      width: 50vw !important; max-width: 50vw !important; min-width: 50vw !important;
      margin-left: 0 !important; margin-right: auto !important; padding-left: 0 !important;
      overflow-x: hidden !important; box-sizing: border-box !important;
    }
    
    body.tgemma-split > * { max-width: 50vw !important; box-sizing: border-box !important; }
    
    /* Sağ Panel body kısıtlamasından muaf tutulur */
    body.tgemma-split > #tgemma-right-panel {
      max-width: none !important;
    }
    
    #tgemma-right-panel {
      position: fixed !important; top: 0 !important; right: 0 !important;
      width: 50vw !important; max-width: 50vw !important; min-width: 50vw !important;
      height: 100vh !important; overflow-y: auto !important; overflow-x: hidden !important;
      z-index: 2147483645 !important; border-left: 3px solid rgba(128, 128, 128, 0.3) !important;
      box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
    }
    #tgemma-right-panel > * { max-width: 100% !important; box-sizing: border-box !important; }

    #tgemma-right-panel img, body.tgemma-split img, #tgemma-right-panel video, body.tgemma-split video {
      max-width: 100% !important; height: auto !important;
    }

    /* Piksel Yüksekliğini Eşitleyen Bekleme Efekti (Skeleton) */
    #tgemma-right-panel .tgemma-pending {
      opacity: 0.25 !important;
      filter: blur(2px) !important;
      pointer-events: none !important;
      transition: all 0.3s ease;
    }

    #tgemma-right-panel .tgemma-translating {
      opacity: 0.6 !important;
      filter: blur(1px) !important;
      color: #3b82f6 !important; /* Çevrildiğini belli eden mavi ton */
    }
  `;
  document.head.appendChild(style);
}

function setupLeftPanelLayout() {
  document.body.classList.add("tgemma-split");
  syncRightPanelTheme();
}

// ──────────────────────────────────────────────────────────────
// 5. AKILLI ANLIK KUYRUK (Viewport Priority)
// Sadece ekranda olanlar listeye girer. Kaydırırsan liste temizlenir.
// ──────────────────────────────────────────────────────────────
function observeRightPanelElements() {
  observer = new IntersectionObserver((entries) => {
    let visibilityChanged = false;
    
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting) {
        visibleSet.add(el);
        visibilityChanged = true;
      } else {
        visibleSet.delete(el);
      }
    });

    if (visibilityChanged && isExtensionEnabled && visibleSet.size > 0 && !isTranslating) {
      processQueue();
    }
  }, { root: rightPanelEl, rootMargin: "50px", threshold: 0.01 });

  const elementsToTranslate = rightPanelEl.querySelectorAll("[data-tgemma-id]");
  elementsToTranslate.forEach((el) => observer.observe(el));
}

// ──────────────────────────────────────────────────────────────
// GÜNCELLENEN KISIM: Fetch yerine Background.js'e mesaj atıyoruz
// ──────────────────────────────────────────────────────────────
async function translateHtml(htmlContent) {
  try {
    const response = await browser.runtime.sendMessage({
      action: "translate",
      htmlContent: htmlContent
    });

    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response ? response.error : "Arka plan hatası");
    }
  } catch (error) {
    console.error("[TGemma] Çeviri iletişim hatası:", error);
    return null;
  }
}

async function processQueue() {
  if (isTranslating || !isExtensionEnabled) return;
  isTranslating = true;

  while (isExtensionEnabled) {
    let targetEl = null;

    for (const el of visibleSet) {
      if (!el.dataset.translated && !el.classList.contains("tgemma-translating")) {
        targetEl = el;
        break;
      }
    }

    if (!targetEl) break;

    targetEl.classList.add("tgemma-translating");
    updateStatus();

    const tgemmaId = targetEl.dataset.tgemmaId;
    const originalHtml = originalTextsMap.get(tgemmaId).html;

    const cleanHtml = originalHtml.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const translatedHtml = await translateHtml(cleanHtml);

    if (translatedHtml && translatedHtml.trim() !== "") {

      let safeTranslated = translatedHtml.replace(/\\n/g, ' ').replace(/\\t/g, ' ');

      targetEl.innerHTML = safeTranslated;
      targetEl.dataset.translated = "true";
      targetEl.classList.remove("tgemma-translating", "tgemma-pending");
      targetEl.classList.add("tgemma-translated");
      totalTranslated++;
    } else {
      targetEl.classList.remove("tgemma-translating");
    }
  }
  
  isTranslating = false;
  updateStatus();
}

// ──────────────────────────────────────────────────────────────
// Geri Kalan UI ve Hover Kodları
// ──────────────────────────────────────────────────────────────
function createTooltipElement() {
  if (document.getElementById("tgemma-tooltip")) return;
  tooltipEl = document.createElement("div");
  tooltipEl.id = "tgemma-tooltip";
  document.documentElement.appendChild(tooltipEl);
}

function showTooltip(el, tgemmaId) {
  if (!tooltipEl) return;
  const original = originalTextsMap.get(tgemmaId);
  if (!original) return;

  const contentDiv = document.createElement("div");
  contentDiv.textContent = original.text;
  tooltipEl.innerHTML = "";
  tooltipEl.appendChild(contentDiv);
  tooltipEl.style.display = "block";

  const rect = el.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

  if (top < 4) top = rect.bottom + 8;
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));

  tooltipEl.style.top = top + "px";
  tooltipEl.style.left = left + "px";
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = "none";
}

function setupHoverSync() {
  let hoverTimeout = null;

  document.documentElement.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tgemma-id]");
    if (!target) return;
    const syncId = target.dataset.tgemmaId;
    if (!syncId) return;

    const isInRightPanel = rightPanelEl && rightPanelEl.contains(target);
    const leftEl = isInRightPanel ? document.body.querySelector(`[data-tgemma-id="${syncId}"]`) : target;
    const rightEl = isInRightPanel ? target : rightPanelEl.querySelector(`[data-tgemma-id="${syncId}"]`);

    if (leftEl) leftEl.dataset.tgemmaHover = "true";
    if (rightEl) rightEl.classList.add("tgemma-hover-translation");

    if (isInRightPanel && target.classList.contains("tgemma-translated")) {
      hoverTimeout = setTimeout(() => showTooltip(target, syncId), 200);
    }
  });

  document.documentElement.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tgemma-id]");
    if (!target) return;
    const syncId = target.dataset.tgemmaId;
    if (!syncId) return;

    const isInRightPanel = rightPanelEl && rightPanelEl.contains(target);
    const leftEl = isInRightPanel ? document.body.querySelector(`[data-tgemma-id="${syncId}"]`) : target;
    const rightEl = isInRightPanel ? target : rightPanelEl.querySelector(`[data-tgemma-id="${syncId}"]`);

    if (leftEl) delete leftEl.dataset.tgemmaHover;
    if (rightEl) rightEl.classList.remove("tgemma-hover-translation");

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    hideTooltip();
  });
}

function setupScrollSync() {
  let isSyncingLeft = false;
  let isSyncingRight = false;

  window.addEventListener("scroll", () => {
    if (!isSyncingLeft && rightPanelEl) {
      isSyncingRight = true;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollRange > 0) {
        const pct = window.scrollY / scrollRange;
        const rightRange = rightPanelEl.scrollHeight - rightPanelEl.clientHeight;
        if (rightRange > 0) rightPanelEl.scrollTop = pct * rightRange;
      }
    }
    isSyncingLeft = false;
  });

  if (rightPanelEl) {
    rightPanelEl.addEventListener("scroll", () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        const rightRange = rightPanelEl.scrollHeight - rightPanelEl.clientHeight;
        if (rightRange > 0) {
          const pct = rightPanelEl.scrollTop / rightRange;
          const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
          if (scrollRange > 0) window.scrollTo(0, pct * scrollRange);
        }
      }
      isSyncingRight = false;
    });
  }
}

function createStatusElement() {
  if (document.getElementById("tgemma-status")) return;
  statusEl = document.createElement("div");
  statusEl.id = "tgemma-status";
  statusEl.innerHTML = `<span class="tgemma-spinner"></span><span class="tgemma-status-text">Çevriliyor...</span>`;
  document.documentElement.appendChild(statusEl);
}

function updateStatus() {
  if (!statusEl) return;
  statusEl.style.display = "flex";
  const textEl = statusEl.querySelector(".tgemma-status-text");
  const spinner = statusEl.querySelector(".tgemma-spinner");

  if (isTranslating) {
    if (textEl) textEl.textContent = `Çevriliyor... ${totalTranslated} / ${totalTranslatable}`;
    if (spinner) spinner.style.display = "";
  } else {
    if (textEl) textEl.textContent = `${totalTranslated} / ${totalTranslatable} çevrildi`;
    if (spinner) spinner.style.display = "none";
    setTimeout(() => { if (statusEl) statusEl.style.display = "none"; }, 3000);
  }
}
