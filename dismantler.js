/**
 * War Era Safe Inventory Dismantler
 * https://app.warera.io
 *
 * Safe auto-dismantler targeting crate-drop knives:
 * - Specifically targets knives (knife SVG path / 'knife.png')
 * - Strictly protects all equipped items, tanks, rifles, and pistols
 * - Directly triggers React onClick mutation on the popover Dismantle item
 * - Scoped strictly to Floating-UI popover portal (_5hjs9w1)
 * - Anti-bot spatial divergence & randomized cadence (~1.5s - 1.8s)
 * - Adaptive backoff on "Please slow down" rate-limit notices
 * - Press 'Esc' anytime or run stopDismantler() to cancel
 */

(function warEraDismantler() {
  if (typeof window.stopDismantler === "function") {
    window.stopDismantler();
  }

  if (!window.location.href.includes("inventory")) {
    alert("[Dismantler] Please navigate to your Inventory (app.warera.io/me/inventory) first.");
    return;
  }

  const baseInterval = 1600;

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
  // 2. Visibility & Click Helpers
  // -----------------------------------------------------------
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

    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
    if (typeof el.click === "function") el.click();
  }

  // -----------------------------------------------------------
  // 3. Knife & Action Finders
  // -----------------------------------------------------------
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

    // 1. Search SVG icons with knife path (M22,2L17.39...)
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

    // 2. Search <img> tags containing "knife.png" or "knife"
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

    // SAFETY: Strictly filter out equipped items
    return candidateTiles.filter(tile => {
      const text = (tile.innerText || "").toLowerCase();
      return !text.includes("equip.") && !text.includes("equipped");
    });
  }

  // Find the active Floating-UI popover container
  function getActivePopover() {
    const popovers = Array.from(document.querySelectorAll("._5hjs9w1, ._5hjs9w2, [data-floating-ui-portal]"));
    return popovers.find(p => isVisible(p));
  }

  // Directly trigger the Dismantle action inside the popover
  function triggerDismantle(popover) {
    if (!popover) return false;
    const elements = Array.from(popover.querySelectorAll("*"));
    const match = elements.find(el => {
      if (!isVisible(el)) return false;
      const t = (el.textContent || el.innerText || "").trim().toLowerCase();
      return t.includes("dismantle") && !t.includes("item");
    });

    if (!match) return false;

    let cur = match;
    let handled = false;

    // Walk up from match to find the Clickable component and its React onClick prop
    while (cur && cur !== popover) {
      const rKey = Object.keys(cur).find(k => k.startsWith("__reactProps$"));
      if (rKey && cur[rKey] && typeof cur[rKey].onClick === "function") {
        console.log("[Dismantler] Invoking React onClick directly on Dismantle button");
        try {
          cur[rKey].onClick({
            target: cur,
            currentTarget: cur,
            stopPropagation: () => {},
            preventDefault: () => {}
          });
          handled = true;
          break;
        } catch (e) {
          console.warn("[Dismantler] React onClick warning:", e);
        }
      }

      // Also dispatch synthetic MouseEvents
      cur.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      cur.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      cur.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (typeof cur.click === "function") {
        cur.click();
        handled = true;
      }

      cur = cur.parentElement;
    }

    return handled;
  }

  function triggerConfirm() {
    const modal = document.querySelector("[role='dialog'], [class*='modal'], [class*='dialog']");
    if (!modal) return false;
    const buttons = Array.from(modal.querySelectorAll("button, [role='button'], div"));
    const confirmBtn = buttons.find(b => {
      if (!isVisible(b)) return false;
      const text = (b.textContent || b.innerText || "").trim().toLowerCase();
      return text.includes("confirm") || text.includes("yes") || (text.includes("dismantle") && !text.includes("cancel"));
    });
    if (confirmBtn) {
      const rKey = Object.keys(confirmBtn).find(k => k.startsWith("__reactProps$"));
      if (rKey && confirmBtn[rKey] && typeof confirmBtn[rKey].onClick === "function") {
        try { confirmBtn[rKey].onClick({ target: confirmBtn, currentTarget: confirmBtn, stopPropagation: () => {}, preventDefault: () => {} }); } catch (e) {}
      }
      confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (typeof confirmBtn.click === "function") confirmBtn.click();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------
  // 4. Main Dismantle Loop
  // -----------------------------------------------------------
  (async function loop() {
    if (expandWeaponsList()) await new Promise(r => setTimeout(r, 600));

    let misses = 0;
    while (isRunning && confirmedDismantled < targetCount) {
      if (isThrottled) { await new Promise(r => setTimeout(r, 500)); continue; }

      const knives = getUnequippedKnives();
      const remainingCount = knives.length;

      if (remainingCount === 0) {
        if (++misses < 3) { expandWeaponsList(); await new Promise(r => setTimeout(r, 800)); continue; }
        console.log("%c[Dismantler] All knives dismantled!", "color: #10b981; font-weight: bold;");
        break;
      }
      misses = 0;

      const targetKnife = knives[0];
      const initialCount = remainingCount;
      const targetLabel = targetCount === Infinity ? "All" : targetCount;

      console.log(`[Dismantler] Found ${remainingCount} knives. Checking popover...`);

      // Check if popover is already open on screen
      let popover = getActivePopover();
      if (!popover) {
        updateHUD(`Opening menu... (${confirmedDismantled}/${targetLabel}) [${remainingCount} knives left]`);
        safeClick(targetKnife);

        const openStart = Date.now();
        while (Date.now() - openStart < 2500) {
          await new Promise(r => setTimeout(r, 120));
          popover = getActivePopover();
          if (popover) break;
        }
      }

      if (!popover) {
        const inner = targetKnife.querySelector("svg, img");
        if (inner) safeClick(inner);
        await new Promise(r => setTimeout(r, 500));
        popover = getActivePopover();
      }

      if (!popover) {
        console.warn("[Dismantler] Could not open popover. Retrying next tick...");
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      console.log(`[Dismantler] Popover confirmed open. Triggering Dismantle...`);
      updateHUD(`Dismantling knife... (${confirmedDismantled}/${targetLabel})`);

      const triggered = triggerDismantle(popover);
      if (!triggered) {
        console.warn("[Dismantler] Could not find Dismantle inside popover. Retrying...");
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      // Check for confirmation modal (if item is Rare+)
      await new Promise(r => setTimeout(r, 250));
      triggerConfirm();

      // Wait for confirmed removal of the knife
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
        console.log(`%c[Dismantler] Confirmed dismantled: ${confirmedDismantled}/${targetLabel} (${left} left)`, "color: #10b981; font-weight: bold;");
      } else {
        console.warn("[Dismantler] Deduction took longer or missed. Retrying next tick...");
      }

      const jitter = (Math.random() - 0.5) * 400;
      await new Promise(r => setTimeout(r, Math.max(1200, baseInterval + jitter)));
    }

    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`🎉 Finished: ${confirmedDismantled}/${targetLabel} knives dismantled`);
    window.stopDismantler();
  })();
})();
