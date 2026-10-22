/**
 * War Era Safe Inventory Dismantler
 * https://app.warera.io
 *
 * Safe auto-dismantler targeting crate-drop knives:
 * - Specifically targets knives ('knife.png' / knife SVG)
 * - Strictly protects all equipped items, tanks, rifles, and pistols
 * - Auto-expands "Show all" if inventory weapons are truncated
 * - Robust portal-aware selector (fixes position:fixed offsetParent bug)
 * - Detailed console logging so you can see every step live
 * - Anti-bot spatial divergence & randomized human cadence (~1.5s - 1.8s)
 * - Adaptive backoff on "Please slow down" rate-limit notices
 * - Auto-handles rare item confirmation dialogs if encountered
 * - Press 'Esc' anytime or run stopDismantler() to cancel
 */

(function warEraDismantler() {
  // If already running, cancel previous instance
  if (typeof window.stopDismantler === "function") {
    window.stopDismantler();
  }

  // Ensure user is on an inventory page
  if (!window.location.href.includes("inventory")) {
    alert("[Dismantler] Please navigate to your Inventory (app.warera.io/me/inventory) first.");
    return;
  }

  const baseInterval = 1600; // Cadence between dismantles (~1.6s)

  // Ask how many knives to dismantle
  let rawInput = prompt("How many knives to dismantle? (Enter a number or 'all')", "all");
  if (rawInput === null) {
    console.log("[Dismantler] Cancelled by user.");
    return;
  }

  rawInput = rawInput.trim().toLowerCase();
  let targetCount = Infinity;
  if (rawInput !== "all" && rawInput !== "") {
    targetCount = parseInt(rawInput, 10);
    if (isNaN(targetCount) || targetCount <= 0) {
      console.log("[Dismantler] Invalid count. Cancelled.");
      return;
    }
  }

  let isRunning = true;
  let confirmedDismantled = 0;
  let isThrottled = false;

  console.log(`%c[Dismantler] Target: ${targetCount === Infinity ? 'ALL' : targetCount} knives. Initializing...`, "color: #10b981; font-weight: bold; font-size: 13px;");
  console.log("%c[Dismantler] Press 'Esc' or run stopDismantler() anytime to stop.", "color: #fbbf24;");

  // Floating On-Screen HUD
  let hud = document.getElementById("warera-dismantler-hud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "warera-dismantler-hud";
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
    hud.innerHTML = `<span>🔪 ${text}</span> <span style="font-size: 11px; color: #94a3b8; font-weight: normal; margin-left: 4px;">[ESC to cancel]</span>`;
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
    }, 3500);
  }

  updateHUD(`Scanning inventory for knives...`);

  window.stopDismantler = () => {
    if (!isRunning) return;
    isRunning = false;
    observer.disconnect();
    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`⏹ Stopped: ${confirmedDismantled}/${targetLabel} dismantled`);
    console.log(`%c[Dismantler] Stopped. Total dismantled: ${confirmedDismantled}/${targetLabel}`, "color: #ef4444; font-weight: bold;");
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      window.stopDismantler();
      window.removeEventListener("keydown", keyHandler);
    }
  };
  window.addEventListener("keydown", keyHandler);

  // -----------------------------------------------------------
  // 1. Adaptive Throttle Watcher ("Please slow down")
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
              const targetLabel = targetCount === Infinity ? "All" : targetCount;
              updateHUD(`Dismantled: ${confirmedDismantled}/${targetLabel}`);
            }, 4000);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // -----------------------------------------------------------
  // 2. Safe Visibility & Click Helpers
  // -----------------------------------------------------------

  // Reliable visibility check (works on position:fixed Floating portals where offsetParent is null)
  function isVisible(el) {
    if (!el) return false;
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function safeClick(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    const rect = el.getBoundingClientRect();
    const u = Math.random() + Math.random();
    const factorX = u > 1 ? 2 - u : u;
    const factorY = (Math.random() + Math.random()) / 2;
    const x = rect.left + rect.width * (0.2 + factorX * 0.6);
    const y = rect.top + rect.height * (0.2 + factorY * 0.6);
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    if (typeof el.click === "function") {
      el.click();
    }
  }

  // -----------------------------------------------------------
  // 3. Knife & Action Finders
  // -----------------------------------------------------------

  // Expand "Show all (X remaining)" if weapons are collapsed
  function expandWeaponsList() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']"));
    const showAllBtn = buttons.find(b => {
      if (!isVisible(b)) return false;
      const t = (b.innerText || "").toLowerCase();
      return t.includes("show all") && t.includes("remaining");
    });
    if (showAllBtn) {
      console.log("[Dismantler] Expanding weapons list...");
      safeClick(showAllBtn);
      return true;
    }
    return false;
  }

  // Find all unequipped knife tiles in the inventory
  function getUnequippedKnives() {
    const candidateTiles = [];

    function findClickableCard(node) {
      let cur = node;
      while (cur && cur !== document.body) {
        if (cur.matches && (cur.matches("button, [role='button'], [class*='cursor-pointer']") || cur.style?.cursor === "pointer")) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return node.parentElement || node;
    }

    // 1. Primary: Search <img> tags containing "knife.png" or "knife"
    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      if (!isVisible(img)) continue;
      const srcStr = ((img.src || "") + " " + (img.alt || "") + " " + (img.srcset || "")).toLowerCase();
      if (srcStr.includes("knife.png") || srcStr.includes("/knife")) {
        const card = findClickableCard(img);
        if (card && isVisible(card) && !candidateTiles.includes(card)) {
          candidateTiles.push(card);
        }
      }
    }

    // 2. Secondary: Search SVG icons with knife path
    const knifePaths = Array.from(document.querySelectorAll("svg path")).filter(p => {
      const d = p.getAttribute("d") || "";
      return d.startsWith("M22,2L17.39") || d.includes("M22,2L17.39,3.75");
    });
    for (const p of knifePaths) {
      const svg = p.closest("svg");
      if (!svg || !isVisible(svg)) continue;
      const card = findClickableCard(svg);
      if (card && isVisible(card) && !candidateTiles.includes(card)) {
        candidateTiles.push(card);
      }
    }

    // SAFETY: Strictly filter out equipped items (has "Equip." badge or text)
    return candidateTiles.filter(tile => {
      const text = (tile.innerText || "").toLowerCase();
      return !text.includes("equip.") && !text.includes("equipped");
    });
  }

  // Find the "Dismantle" option in the open popover menu
  function getDismantleMenuItem() {
    // Look everywhere including Floating UI portals
    const allElements = Array.from(document.querySelectorAll("button, [role='button'], div, a, span"));
    return allElements.find(el => {
      if (!isVisible(el)) return false;
      const text = (el.innerText || "").trim().toLowerCase();
      if (!text) return false;

      // Exclude top-level supporter bulk dismantle button
      if (text.includes("supporter") || text.includes("craft")) return false;

      // Exclude confirmation modal title/dialog header
      if (text === "dismantle item") return false;

      // Match the action menu "Dismantle" entry (e.g. "Dismantle", "Dismantle\n+2", "Dismantle +2")
      return text === "dismantle" || text.startsWith("dismantle\n") || text.startsWith("dismantle ") || (text.includes("dismantle") && text.includes("+"));
    });
  }

  // Find modal confirmation button (for rare items)
  function getConfirmationButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    return buttons.find(b => {
      if (!isVisible(b)) return false;
      const text = (b.innerText || "").trim().toLowerCase();
      return text === "confirm" || text === "yes";
    });
  }

  // -----------------------------------------------------------
  // 4. Main Dismantle Loop
  // -----------------------------------------------------------
  (async function loop() {
    if (expandWeaponsList()) {
      await new Promise(r => setTimeout(r, 600));
    }

    let consecutiveMisses = 0;

    while (isRunning && confirmedDismantled < targetCount) {
      if (isThrottled) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const knives = getUnequippedKnives();
      const remainingCount = knives.length;

      if (remainingCount === 0) {
        consecutiveMisses++;
        if (consecutiveMisses < 3) {
          expandWeaponsList();
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        console.log("%c[Dismantler] No more unequipped knives found in inventory.", "color: #10b981; font-weight: bold;");
        break;
      }

      consecutiveMisses = 0;
      const targetKnife = knives[0];
      const initialCount = remainingCount;
      const targetLabel = targetCount === Infinity ? "All" : targetCount;

      console.log(`[Dismantler] Found ${remainingCount} knives. Clicking knife #1...`);
      updateHUD(`Opening menu... (${confirmedDismantled}/${targetLabel}) [${remainingCount} knives left]`);

      // 1. Click knife tile to open action popover
      safeClick(targetKnife);

      // Wait for popover menu to appear
      let dismantleBtn = null;
      const openStart = Date.now();
      while (Date.now() - openStart < 2500) {
        await new Promise(r => setTimeout(r, 120));
        dismantleBtn = getDismantleMenuItem();
        if (dismantleBtn) break;
      }

      if (!dismantleBtn) {
        console.warn("[Dismantler] Menu did not appear or Dismantle button not found. Retrying with direct click...");
        // Fallback: try clicking direct child if wrapper was clicked
        const innerImg = targetKnife.querySelector("img, svg");
        if (innerImg) safeClick(innerImg);
        await new Promise(r => setTimeout(r, 500));
        dismantleBtn = getDismantleMenuItem();
      }

      if (!dismantleBtn) {
        console.warn("[Dismantler] Could not locate Dismantle menu item. Retrying next tick...");
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      console.log(`[Dismantler] Popover opened. Clicking Dismantle: "${dismantleBtn.innerText.replace(/\n/g, ' ')}"`);
      updateHUD(`Dismantling knife... (${confirmedDismantled}/${targetLabel})`);

      // 2. Click "Dismantle" in the popover
      safeClick(dismantleBtn);

      // 3. Check for confirmation modal (if item is Rare+)
      await new Promise(r => setTimeout(r, 250));
      const confirmBtn = getConfirmationButton();
      if (confirmBtn) {
        console.log("[Dismantler] Confirming dismantle dialog...");
        safeClick(confirmBtn);
      }

      // 4. Wait for confirmed removal of the knife
      const actionTime = Date.now();
      let confirmed = false;
      while (Date.now() - actionTime < 4500) {
        await new Promise(r => setTimeout(r, 200));
        const currentKnives = getUnequippedKnives();
        if (currentKnives.length < initialCount || !document.body.contains(targetKnife)) {
          confirmed = true;
          break;
        }
      }

      if (confirmed) {
        confirmedDismantled++;
        const left = Math.max(0, initialCount - 1);
        updateHUD(`Dismantled ${confirmedDismantled}/${targetLabel} (${left} remaining)`);
        console.log(`%c[Dismantler] Confirmed dismantled: ${confirmedDismantled}/${targetLabel} (${left} left)`, "color: #10b981;");
      } else {
        console.warn("[Dismantler] Deduction took longer or missed. Retrying next tick...");
      }

      // Calm bounce pause (~1.5s +/- 200ms)
      const jitter = (Math.random() - 0.5) * 400;
      await new Promise(r => setTimeout(r, Math.max(1200, baseInterval + jitter)));
    }

    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    if (confirmedDismantled >= targetCount) {
      closeHUD(`🎉 Target of ${targetCount} knives dismantled!`);
      console.log(`%c[Dismantler] Target reached: ${targetCount} knives dismantled!`, "color: #10b981; font-weight: bold; font-size: 13px;");
    } else {
      closeHUD(`⏹ Finished: ${confirmedDismantled} knives dismantled`);
      console.log(`%c[Dismantler] Finished: ${confirmedDismantled} knives dismantled.`, "color: #10b981; font-weight: bold;");
    }

    window.stopDismantler();
  })();
})();
