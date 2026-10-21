const countInput = document.getElementById("countInput");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDiv = document.getElementById("status");
const presetBtns = document.querySelectorAll(".presets button");

presetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    countInput.value = btn.dataset.val;
  });
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

startBtn.addEventListener("click", async () => {
  const count = parseInt(countInput.value, 10);
  if (isNaN(count) || count <= 0) {
    statusDiv.style.color = "#f87171";
    statusDiv.textContent = "Please enter a valid count (> 0)";
    return;
  }

  const tab = await getActiveTab();
  if (!tab || !tab.url || !tab.url.includes("warera.io")) {
    statusDiv.style.color = "#f87171";
    statusDiv.textContent = "Open War Era (app.warera.io) first!";
    return;
  }

  statusDiv.style.color = "#34d399";
  statusDiv.textContent = `Starting ${count} crates... Check in-game HUD!`;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: runInPageOpener,
    args: [count]
  });

  setTimeout(() => {
    window.close();
  }, 700);
});

stopBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab && tab.id) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        if (typeof window.stopOpener === "function") {
          window.stopOpener();
        }
      }
    });
    statusDiv.style.color = "#f87171";
    statusDiv.textContent = "Stopped.";
  }
});

// =============================================================
// IN-PAGE EXECUTION FUNCTION (Runs directly in page context)
// =============================================================
function runInPageOpener(targetCount) {
  // If already running, cancel previous instance first
  if (typeof window.stopOpener === "function") {
    window.stopOpener();
  }

  const baseInterval = 1800;
  let isRunning = true;
  let confirmedOpened = 0;
  let isThrottled = false;
  let retryCount = 0;

  // -----------------------------------------------------------
  // Floating On-Screen HUD
  // -----------------------------------------------------------
  let hud = document.getElementById("warera-opener-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "warera-opener-hud";
    hud.style.cssText = `
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 20, 26, 0.95);
      border: 1px solid #10b981;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      color: #e2e8f0;
      padding: 10px 18px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      z-index: 9999999;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.25s ease;
    `;
    document.body.appendChild(hud);
  }

  function updateHUD(text, isAlert = false) {
    if (!hud) return;
    hud.style.borderColor = isAlert ? "#f97316" : "#10b981";
    hud.innerHTML = `<span>📦 ${text}</span> <span style="font-size: 11px; color: #94a3b8; font-weight: normal; margin-left: 4px;">[ESC to cancel]</span>`;
  }

  function closeHUD(finalText) {
    if (!hud) return;
    hud.style.borderColor = "#3b82f6";
    hud.innerHTML = `<span>${finalText}</span>`;
    setTimeout(() => {
      if (hud && hud.parentElement) {
        hud.style.opacity = "0";
        setTimeout(() => hud.remove(), 300);
      }
    }, 3000);
  }

  updateHUD(`Starting... 0/${targetCount} opened`);

  // Stop controller
  window.stopOpener = () => {
    if (!isRunning) return;
    isRunning = false;
    observer.disconnect();
    closeHUD(`⏹ Opener stopped. Total opened: ${confirmedOpened}/${targetCount}`);
    console.log(`[Opener] Stopped. Confirmed opened: ${confirmedOpened}/${targetCount}`);
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      window.stopOpener();
      window.removeEventListener("keydown", keyHandler);
    }
  };
  window.addEventListener("keydown", keyHandler);

  // -----------------------------------------------------------
  // Adaptive Throttle Watcher
  // -----------------------------------------------------------
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const txt = (node.innerText || "").toLowerCase();
          if (txt.includes("slow down") || txt.includes("please slow down")) {
            console.warn(`[Throttle] Rate limit detected. Pausing 4s...`);
            updateHUD(`Rate limit paused (4s)...`, true);
            isThrottled = true;
            setTimeout(() => {
              isThrottled = false;
              updateHUD(`Opened: ${confirmedOpened}/${targetCount}`);
            }, 4000);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // -----------------------------------------------------------
  // Safe Click (Pure MouseEvent)
  // -----------------------------------------------------------
  function safeClick(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const rect = el.getBoundingClientRect();
    const u = Math.random() + Math.random();
    const factorX = u > 1 ? 2 - u : u;
    const factorY = (Math.random() + Math.random()) / 2;
    const x = rect.left + rect.width * (0.2 + factorX * 0.6);
    const y = rect.top + rect.height * (0.2 + factorY * 0.6);
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    el.dispatchEvent(new MouseEvent("mousedown", opts));
    setTimeout(() => {
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    }, 40 + Math.random() * 40);
  }

  // -----------------------------------------------------------
  // Element Finders
  // -----------------------------------------------------------
  function getOpenCaseButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    return buttons.find(b => {
      if (b.offsetParent === null) return false;
      const t = (b.innerText || "").trim().toLowerCase();
      if (t.includes("supporter") || t.includes("open 10") || t.includes("open 5") || t.includes("open all")) return false;
      return t.includes("open case");
    });
  }

  function getRemainingCount() {
    const btn = getOpenCaseButton();
    if (!btn) return null;
    const m = (btn.innerText || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function getInventoryCrate() {
    const imgs = Array.from(document.querySelectorAll("img"));
    const crateImg = imgs.find(i => {
      if (i.offsetParent === null) return false;
      const s = ((i.src || '') + ' ' + (i.alt || '')).toLowerCase();
      return s.includes('case') || s.includes('crate') || s.includes('box') || s.includes('loot');
    });
    if (crateImg) {
      return crateImg.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || crateImg.parentElement;
    }

    const clickables = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']"));
    const textCrate = clickables.find(el => {
      if (el.offsetParent === null) return false;
      const t = (el.innerText || '').toLowerCase();
      if (t.includes('craft') || t.includes('dismantle') || t.includes('equip') || t.includes('supporter')) return false;
      return t.includes('case') || t.includes('crate') || t.includes('box');
    });
    if (textCrate) return textCrate;

    const firstItem = document.querySelector("[class*='inventory'] [class*='grid'] > div, [class*='inventory'] [class*='item']");
    if (firstItem && firstItem.offsetParent !== null) return firstItem;
    return null;
  }

  // -----------------------------------------------------------
  // Main Execution Loop
  // -----------------------------------------------------------
  (async function loop() {
    while (isRunning && confirmedOpened < targetCount) {
      if (isThrottled) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const openBtn = getOpenCaseButton();

      // CASE 1: Modal is open
      if (openBtn) {
        retryCount = 0;
        const isDisabled = openBtn.disabled || openBtn.getAttribute("aria-disabled") === "true";
        if (isDisabled) {
          await new Promise(r => setTimeout(r, 250));
          continue;
        }

        const countBefore = getRemainingCount();
        if (countBefore === null || countBefore <= 0) {
          console.log("[Opener] No more crates remaining.");
          break;
        }

        safeClick(openBtn);

        const clickTime = Date.now();
        let confirmed = false;
        while (Date.now() - clickTime < 7000) {
          await new Promise(r => setTimeout(r, 200));
          const currentCount = getRemainingCount();
          if (currentCount !== null && currentCount < countBefore) {
            confirmed = true;
            break;
          }
        }

        if (confirmed) {
          confirmedOpened++;
          const stock = getRemainingCount();
          updateHUD(`Opened ${confirmedOpened}/${targetCount} (Stock: ${stock !== null ? stock : '?'})`);
          console.log(`[Opener] Confirmed Open ${confirmedOpened}/${targetCount}`);
        } else {
          console.warn("[Opener] Spin animation took longer or click was missed. Retrying next tick...");
        }

        const jitter = (Math.random() - 0.5) * 400;
        await new Promise(r => setTimeout(r, Math.max(1400, baseInterval + jitter)));
        continue;
      }

      // CASE 2: Modal closed -> click crate in inventory
      const crate = getInventoryCrate();
      if (crate) {
        updateHUD(`Opening modal from inventory...`);
        safeClick(crate);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      retryCount++;
      if (retryCount < 4) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      console.log("[Opener] No crate or modal found in inventory.");
      break;
    }

    if (confirmedOpened >= targetCount) {
      closeHUD(`🎉 Target of ${targetCount} confirmed boxes reached!`);
    } else {
      closeHUD(`⏹ Finished: ${confirmedOpened}/${targetCount} boxes opened`);
    }

    window.stopOpener();
  })();
}
