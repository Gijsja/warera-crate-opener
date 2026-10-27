/**
 * War Era Safe Crate Opener
 * https://app.warera.io
 *
 * Safe single-case auto-opener with:
 * - Server-confirmed deduction counting (tracks badge drops, no false counts)
 * - Auto-modal reopening (clicks crate in inventory if modal is closed)
 * - Pure MouseEvents (prevents React 18 / Next.js setPointerCapture crashes)
 * - Anti-detection spatial divergence & humanized bounce intervals (~1.8s)
 * - Adaptive backoff on "Please slow down" rate-limit notices
 * - Auto-enables "Quick animation" for ~2.3x faster spins
 * - Interactive HUD with clickable [STOP] button and 'Esc' key listener
 */

(function warEraOpener() {
  const instanceId = Date.now() + Math.random();
  window.__WARERA_OPENER_ID__ = instanceId;

  // If already running, cancel previous instance
  if (typeof window.stopOpener === "function") {
    try {
      window.stopOpener();
    } catch (e) {}
  }

  // Prevent NextJS / Clickable Element.setPointerCapture DOMException on synthetic interactions
  if (typeof Element.prototype.setPointerCapture === "function" && !Element.prototype.__warera_capture_patched__) {
    const origSetPointerCapture = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function(pointerId) {
      try {
        return origSetPointerCapture.call(this, pointerId);
      } catch (e) {
        // Silently ignore invalid pointer id
      }
    };
    Element.prototype.__warera_capture_patched__ = true;
  }

  const baseInterval = 1800; // Average click cadence (~1.8s)
  let rawInput = prompt("How many boxes to open? (e.g. 10, 25, 30, or 'all'):", "10");
  if (rawInput === null) {
    console.log("[Opener] Cancelled.");
    return;
  }

  rawInput = rawInput.trim().toLowerCase();
  let targetCount = 10;
  if (rawInput === "all") {
    targetCount = Infinity;
  } else if (rawInput !== "") {
    targetCount = parseInt(rawInput, 10);
    if (isNaN(targetCount) || targetCount <= 0) {
      console.log("[Opener] Invalid count entered. Cancelled.");
      return;
    }
  }

  let isRunning = true;
  let confirmedOpened = 0;
  let isThrottled = false;
  let retryCount = 0;

  const isStillActive = () => isRunning && window.__WARERA_OPENER_ID__ === instanceId;

  console.log(`%c[Opener] Target: ${targetCount === Infinity ? "ALL" : targetCount} confirmed boxes. Starting...`, "color: #10b981; font-weight: bold;");
  console.log("%c[Opener] Press 'Esc' or click [⏹ STOP] to cancel anytime.", "color: #fbbf24;");

  // -----------------------------------------------------------
  // 1. Floating On-Screen HUD with Clickable [STOP] Button
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
      padding: 8px 16px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      z-index: 9999999;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.25s ease;
      user-select: none;
    `;
    document.body.appendChild(hud);
  }

  function updateHUD(text, isAlert = false) {
    if (!hud) return;
    hud.style.borderColor = isAlert ? "#f97316" : "#10b981";
    hud.innerHTML = `
      <span>📦 ${text}</span>
      <button id="warera-opener-stop-btn" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        outline: none;
      ">⏹ STOP</button>
    `;
    const btn = document.getElementById("warera-opener-stop-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.stopOpener();
      };
    }
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

  const targetLabel = targetCount === Infinity ? "All" : targetCount;
  updateHUD(`Starting... 0/${targetLabel} opened`);

  window.stopOpener = () => {
    if (!isRunning) return;
    isRunning = false;
    observer.disconnect();
    window.removeEventListener("keydown", keyHandler);
    closeHUD(`⏹ Stopped. Total opened: ${confirmedOpened}/${targetLabel}`);
    console.log(`%c[Opener] Stopped. Confirmed opened: ${confirmedOpened}/${targetLabel}`, "color: #ef4444; font-weight: bold;");
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      window.stopOpener();
    }
  };
  window.addEventListener("keydown", keyHandler);

  // -----------------------------------------------------------
  // 2. Adaptive Throttle Watcher ("Please slow down")
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
              updateHUD(`Opened: ${confirmedOpened}/${targetLabel}`);
            }, 4000);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // -----------------------------------------------------------
  // 3. Safe Click (Pure MouseEvents - No setPointerCapture bugs)
  // -----------------------------------------------------------
  function safeClick(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const rect = el.getBoundingClientRect();
    const u = Math.random() + Math.random();
    const factorX = u > 1 ? 2 - u : u;
    const factorY = (Math.random() + Math.random()) / 2;
    const x = rect.left + rect.width * (0.2 + factorX * 0.6);
    const y = rect.top + rect.height * (0.2 + factorY * 0.6);
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons: 1 };

    el.dispatchEvent(new MouseEvent("mousedown", opts));
    setTimeout(() => {
      el.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
    }, 40 + Math.random() * 40);
  }

  // -----------------------------------------------------------
  // 4. React Fiber Helper
  // -----------------------------------------------------------
  function getFiber(domNode) {
    if (!domNode) return null;
    const key = Object.keys(domNode).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    return key ? domNode[key] : null;
  }

  // -----------------------------------------------------------
  // 5. Element Finders & Modal Detection
  // -----------------------------------------------------------

  /**
   * Identifies the single-case "OPEN" button in the modal.
   * Handles:
   * - New War Era: button text is "OPEN (33)" / "OPEN"
   * - Old War Era: button text was "OPEN CASE (33)" / "OPEN CASE"
   * Strictly excludes "OPEN ALL", "Supporter" buttons, and "CLOSE" buttons.
   */
  function getOpenCaseButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    return buttons.find(b => {
      if (b.offsetParent === null) return false;
      const t = (b.innerText || "").trim().toLowerCase();

      // Exclude supporter actions, bulk opens, and close buttons
      if (
        t.includes("supporter") ||
        t.includes("open all") ||
        t.includes("open 10") ||
        t.includes("open 5") ||
        t.includes("close")
      ) return false;

      // Normalize whitespace & line breaks (e.g. "open\n33" -> "open 33")
      const normalized = t.replace(/\s+/g, " ");

      // Match "open", "open 33", "open case", "open case 33"
      if (
        normalized === "open" ||
        normalized === "open case" ||
        /^open(\s+case)?(\s+\d+)?$/i.test(normalized)
      ) {
        return true;
      }

      // Check if button is inside modal dialog and starts with "open"
      const modal = b.closest("[role='dialog'], [class*='modal'], ._95tvfh7");
      if (modal && /^open/i.test(normalized) && !normalized.includes("open all")) {
        return true;
      }

      return false;
    });
  }

  /**
   * Checks whether the case opening modal is currently rendered on screen.
   */
  function isModalOpen() {
    if (getOpenCaseButton()) return true;
    const bodyTxt = (document.body.innerText || "").toLowerCase();
    return (
      bodyTxt.includes("total cases opened") ||
      bodyTxt.includes("quick animation") ||
      (bodyTxt.includes("equipment 70%") && bodyTxt.includes("weapon 30%"))
    );
  }

  /**
   * Automatically enables the "Quick animation" option if available.
   * Speeds up spin duration from 1600ms down to 700ms.
   */
  function ensureQuickAnimation() {
    try {
      if (window.localStorage.getItem("openCase.quickSpin") !== "1") {
        window.localStorage.setItem("openCase.quickSpin", "1");
      }
      const labels = Array.from(document.querySelectorAll("label, span, div, [role='checkbox'], input[type='checkbox']"));
      for (const el of labels) {
        const txt = (el.innerText || el.textContent || "").toLowerCase();
        if (txt.includes("quick animation")) {
          const input = el.tagName === "INPUT" ? el : el.querySelector("input[type='checkbox']");
          if (input && !input.checked) {
            safeClick(input);
          } else if (!input && (el.getAttribute("aria-checked") === "false" || el.classList.contains("unchecked"))) {
            safeClick(el);
          }
          break;
        }
      }
    } catch (e) {}
  }

  /**
   * Extracts remaining crate count from button badge or modal text.
   */
  function getRemainingCount() {
    const btn = getOpenCaseButton();
    if (btn) {
      const m = (btn.innerText || "").match(/\d+/);
      if (m) return parseInt(m[0], 10);
    }
    // Fallback: check OPEN ALL button or sibling badge (e.g. "OPEN ALL (33)")
    const openAllBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => {
      const t = (b.innerText || "").toLowerCase();
      return t.includes("open all") && /\d+/.test(t);
    });
    if (openAllBtn) {
      const m = (openAllBtn.innerText || "").match(/\d+/);
      if (m) return parseInt(m[0], 10);
    }
    return null;
  }

  /**
   * Finds crate in inventory when modal is closed.
   * Uses React Fiber props (itemCode: "case1", "case2", "toolbox", "woodenCase")
   * and safe image/alt heuristics without blind fallback clicks.
   */
  function getInventoryCrate() {
    // 1. React Fiber props lookup
    const allDivs = Array.from(document.querySelectorAll("[class*='inventory'] div, [class*='grid'] div, button, [role='button']"));
    for (const el of allDivs) {
      if (el.offsetParent === null) continue;
      const fiber = getFiber(el);
      if (fiber) {
        let f = fiber;
        let depth = 0;
        while (f && depth < 10) {
          const props = f.memoizedProps;
          if (props) {
            const code = props.itemCode || props.item?.code || props.caseCode;
            if (code === "case1" || code === "case2" || code === "toolbox" || code === "woodenCase") {
              return el;
            }
          }
          f = f.return;
          depth++;
        }
      }
    }

    // 2. Images with crate/case/box in src or alt
    const imgs = Array.from(document.querySelectorAll("img"));
    const crateImg = imgs.find(i => {
      if (i.offsetParent === null) return false;
      const s = ((i.src || '') + ' ' + (i.alt || '')).toLowerCase();
      return s.includes('case') || s.includes('crate') || s.includes('box') || s.includes('loot');
    });
    if (crateImg) {
      return crateImg.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || crateImg.parentElement;
    }

    // 3. Clickable elements with case/crate text
    const clickables = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']"));
    const textCrate = clickables.find(el => {
      if (el.offsetParent === null) return false;
      const t = (el.innerText || '').toLowerCase();
      if (t.includes('craft') || t.includes('dismantle') || t.includes('equip') || t.includes('supporter')) return false;
      return t.includes('case') || t.includes('crate') || t.includes('box');
    });
    if (textCrate) return textCrate;

    return null;
  }

  // -----------------------------------------------------------
  // 6. Main Open Loop
  // -----------------------------------------------------------
  (async function loop() {
    while (isStillActive() && confirmedOpened < targetCount) {
      if (isThrottled) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const modalOpen = isModalOpen();
      const openBtn = getOpenCaseButton();

      // CASE 1: Modal is open and open button is ready
      if (openBtn) {
        retryCount = 0;
        ensureQuickAnimation();

        const isDisabled = openBtn.disabled || openBtn.getAttribute("aria-disabled") === "true";
        if (isDisabled) {
          await new Promise(r => setTimeout(r, 250));
          continue;
        }

        const countBefore = getRemainingCount();
        if (countBefore !== null && countBefore <= 0) {
          console.log("[Opener] No more crates remaining in stock.");
          break;
        }

        safeClick(openBtn);

        // Wait for confirmed deduction in the badge count
        const clickTime = Date.now();
        let confirmed = false;
        while (Date.now() - clickTime < 7000 && isStillActive()) {
          await new Promise(r => setTimeout(r, 200));
          const currentCount = getRemainingCount();
          if (currentCount !== null && countBefore !== null && currentCount < countBefore) {
            confirmed = true;
            break;
          }
        }

        if (confirmed) {
          confirmedOpened++;
          const stock = getRemainingCount();
          updateHUD(`Opened ${confirmedOpened}/${targetLabel} (Stock: ${stock !== null ? stock : '?'})`);
          console.log(`[Opener] Confirmed Open ${confirmedOpened}/${targetLabel} (Stock: ${stock})`);
        } else {
          console.warn("[Opener] Spin animation took longer or click was missed. Retrying next tick...");
        }

        // Calm bounce pause (~1.8s +/- 200ms)
        const jitter = (Math.random() - 0.5) * 400;
        await new Promise(r => setTimeout(r, Math.max(1400, baseInterval + jitter)));
        continue;
      }

      // If modal is open but button is momentarily spinning/animating, wait for reel to stop
      if (modalOpen) {
        await new Promise(r => setTimeout(r, 350));
        continue;
      }

      // CASE 2: Modal closed -> click crate in inventory to open modal
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
      closeHUD(`🎉 Target of ${targetLabel} confirmed boxes reached!`);
      console.log(`%c[Opener] Target of ${targetLabel} confirmed boxes reached!`, "color: #10b981; font-weight: bold; font-size: 13px;");
    } else {
      closeHUD(`⏹ Finished: ${confirmedOpened}/${targetLabel} boxes opened`);
    }

    window.stopOpener();
  })();
})();
