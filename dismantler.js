/**
 * War Era Safe Inventory Dismantler
 * https://app.warera.io
 *
 * Safe auto-dismantler targeting crate-drop knives:
 * - Specifically targets knives ('knife.png' / knife SVG)
 * - Strictly protects all equipped items, tanks, rifles, and pistols
 * - Auto-expands "Show all" if inventory weapons are truncated
 * - Server-confirmed deduction tracking (verifies tile removal or count drop)
 * - Pure MouseEvents (bypasses React 18 / Next.js setPointerCapture bugs)
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

  const baseInterval = 1600; // Average cadence between dismantles (~1.6s)

  // Ask how many knives to dismantle
  let rawInput = prompt("How many knives to dismantle? (Enter a number or 'all')", "all");
  if (rawInput === null) {
    console.log("[Dismantler] Cancelled.");
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

  console.log(`%c[Dismantler] Target: ${targetCount === Infinity ? 'ALL' : targetCount} knives. Starting...`, "color: #10b981; font-weight: bold;");
  console.log("%c[Dismantler] Press 'Esc' or run stopDismantler() to cancel anytime.", "color: #fbbf24;");

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
    }, 3000);
  }

  updateHUD(`Scanning inventory for knives...`);

  window.stopDismantler = () => {
    if (!isRunning) return;
    isRunning = false;
    observer.disconnect();
    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`⏹ Dismantler stopped. Total: ${confirmedDismantled}/${targetLabel}`);
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
  // 2. Safe Click (Pure MouseEvents - No setPointerCapture bugs)
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
  // 3. Knife & Action Finders
  // -----------------------------------------------------------

  // Expand "Show all (X remaining)" if weapons are collapsed
  function expandWeaponsList() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']"));
    const showAllBtn = buttons.find(b => {
      if (b.offsetParent === null) return false;
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

    // Helper to find clickable card parent
    function findCardParent(node) {
      let cur = node;
      while (cur && cur !== document.body) {
        if (cur.matches && cur.matches("button, [role='button'], [class*='cursor-pointer']")) {
          return cur;
        }
        if (cur.style && cur.style.cursor === "pointer") {
          return cur;
        }
        cur = cur.parentElement;
      }
      return node.parentElement;
    }

    // 1. Primary finder: Search <img> tags containing "knife.png" or "knife"
    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      if (img.offsetParent === null) continue;
      const srcStr = ((img.src || "") + " " + (img.alt || "") + " " + (img.srcset || "")).toLowerCase();
      if (srcStr.includes("knife.png") || srcStr.includes("/knife")) {
        const card = findCardParent(img);
        if (card && card.offsetParent !== null && !candidateTiles.includes(card)) {
          candidateTiles.push(card);
        }
      }
    }

    // 2. Secondary finder: Search SVG icons with the knife path
    const knifePaths = Array.from(document.querySelectorAll("svg path")).filter(p => {
      const d = p.getAttribute("d") || "";
      return d.startsWith("M22,2L17.39") || d.includes("M22,2L17.39,3.75");
    });
    for (const p of knifePaths) {
      const svg = p.closest("svg");
      if (!svg || svg.offsetParent === null) continue;
      const card = findCardParent(svg);
      if (card && card.offsetParent !== null && !candidateTiles.includes(card)) {
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
    const clickables = Array.from(document.querySelectorAll("button, [role='button'], div, a"));
    return clickables.find(el => {
      if (el.offsetParent === null) return false;
      const text = (el.innerText || "").trim().toLowerCase();
      // Exclude top-level supporter bulk dismantle button
      if (text.includes("supporter") || text.includes("craft")) return false;
      // Match the action menu "Dismantle" entry
      return text === "dismantle" || text.startsWith("dismantle\n") || text.startsWith("dismantle ");
    });
  }

  // Find modal confirmation button (for rare items)
  function getConfirmationButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    return buttons.find(b => {
      if (b.offsetParent === null) return false;
      const text = (b.innerText || "").trim().toLowerCase();
      return text === "confirm" || text === "dismantle item" || text === "yes";
    });
  }

  // -----------------------------------------------------------
  // 4. Main Dismantle Loop
  // -----------------------------------------------------------
  (async function loop() {
    // Expand list first if collapsed
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
          // Retry in case DOM is re-rendering or expanding
          expandWeaponsList();
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        console.log("[Dismantler] No more unequipped knives found in inventory.");
        break;
      }

      consecutiveMisses = 0;
      const targetKnife = knives[0];
      const initialCount = remainingCount;
      const targetLabel = targetCount === Infinity ? "All" : targetCount;

      updateHUD(`Opening knife menu... (${confirmedDismantled}/${targetLabel}) [${remainingCount} in stock]`);

      // 1. Click knife tile to open action popover
      safeClick(targetKnife);

      // Wait for popover menu to appear
      let dismantleBtn = null;
      const openStart = Date.now();
      while (Date.now() - openStart < 2000) {
        await new Promise(r => setTimeout(r, 150));
        dismantleBtn = getDismantleMenuItem();
        if (dismantleBtn) break;
      }

      if (!dismantleBtn) {
        console.warn("[Dismantler] Menu did not appear. Retrying...");
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // 2. Click "Dismantle" in the popover
      updateHUD(`Dismantling knife... (${confirmedDismantled}/${targetLabel})`);
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
        updateHUD(`Dismantled ${confirmedDismantled}/${targetLabel} (Remaining: ${left})`);
        console.log(`[Dismantler] Confirmed dismantled: ${confirmedDismantled}/${targetLabel} (${left} knives remaining)`);
      } else {
        console.warn("[Dismantler] Deduction took longer or missed. Retrying next tick...");
      }

      // Calm bounce pause (~1.6s +/- 200ms)
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
