/**
 * War Era Gentle & Humanized Inventory Knife Dismantler
 * https://app.warera.io
 *
 * Safe auto-dismantler targeting crate-drop knives:
 * - Single-Action Dispatch: Eliminates click hammering (no duplicate multi-trigger spamming)
 * - Pure MouseEvents: Zero synthetic PointerEvents to eliminate Element.setPointerCapture crashes
 * - Target Shield: Strictly excludes equipped items, pistols, rifles, tanks, and armor
 * - Guaranteed Stop: Halts immediately when target count is reached
 * - Interactive HUD with Clickable [STOP] Button & 'Esc' Key listener
 * - Human Pacing & Throttle Cooldown: Natural cadence (~2.2s - 2.8s) + 7s rate-limit backoff
 */

(function warEraDismantler() {
  const instanceId = Date.now() + Math.random();
  window.__WARERA_DISMANTLER_ID__ = instanceId;

  if (typeof window.stopDismantler === "function") {
    try {
      window.stopDismantler();
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

  if (!window.location.href.includes("inventory")) {
    alert("[Dismantler] Please navigate to your Inventory (app.warera.io/user/.../inventory) first.");
    return;
  }

  // Gentle human cadence: ~2.3 seconds base delay
  const baseInterval = 2300;

  let rawInput = prompt(
    "How many knives to dismantle?\n\nEnter a number (e.g. 5, 10, 20) or 'all' to dismantle all unequipped knives:",
    "10"
  );
  if (rawInput === null) {
    console.log("[Dismantler] Cancelled by user.");
    return;
  }

  rawInput = rawInput.trim().toLowerCase();
  let targetCount = 10;
  if (rawInput === "all") {
    targetCount = Infinity;
  } else if (rawInput !== "") {
    targetCount = parseInt(rawInput, 10);
    if (isNaN(targetCount) || targetCount <= 0) {
      console.log("[Dismantler] Invalid count entered. Cancelled.");
      return;
    }
  }

  let isRunning = true;
  let confirmedDismantled = 0;
  let isThrottled = false;
  let throttleBackoff = 0;

  const isStillActive = () => isRunning && window.__WARERA_DISMANTLER_ID__ === instanceId;

  // Interruptible sleep helper: checks active status every 30ms
  function sleep(ms) {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (!isStillActive() || Date.now() - start >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, 30);
    });
  }

  console.log(
    `%c[Dismantler] Target: ${targetCount === Infinity ? "ALL" : targetCount} knives. Initializing gentle human engine...`,
    "color: #10b981; font-weight: bold; font-size: 13px;"
  );

  // -----------------------------------------------------------
  // 1. Floating Interactive On-Screen HUD
  // -----------------------------------------------------------
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
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.7);
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
      user-select: none;
      transition: all 0.2s ease;
    `;
    document.body.appendChild(hud);
  }

  function updateHUD(text, isAlert = false) {
    if (!hud) return;
    hud.style.borderColor = isAlert ? "#f97316" : "#10b981";
    hud.innerHTML = `
      <span>🔪 ${text}</span>
      <button id="warera-dismantler-stop-btn" style="
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
    const btn = document.getElementById("warera-dismantler-stop-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.stopDismantler();
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
    }, 4000);
  }

  updateHUD(`Scanning inventory for knives...`);

  window.stopDismantler = () => {
    if (!isRunning) return;
    isRunning = false;
    observer.disconnect();
    window.removeEventListener("keydown", keyHandler);
    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`⏹ Stopped: ${confirmedDismantled}/${targetLabel} dismantled`);
    console.log(
      `%c[Dismantler] Stopped. Total dismantled: ${confirmedDismantled}/${targetLabel}`,
      "color: #ef4444; font-weight: bold; font-size: 13px;"
    );
  };

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      window.stopDismantler();
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
            console.warn(`[Dismantler] Rate limit detected. Pausing 7s for full cooldown...`);
            updateHUD(`Rate limit cool down (7s)...`, true);
            isThrottled = true;
            throttleBackoff = Math.min(throttleBackoff + 600, 2400);
            setTimeout(() => {
              isThrottled = false;
              const targetLabel = targetCount === Infinity ? "All" : targetCount;
              updateHUD(`Dismantled: ${confirmedDismantled}/${targetLabel}`);
            }, 7000);
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // -----------------------------------------------------------
  // 3. React Fiber & React Props Helpers
  // -----------------------------------------------------------
  function getFiber(domNode) {
    if (!domNode) return null;
    const key = Object.keys(domNode).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    return key ? domNode[key] : null;
  }

  function getReactProps(domNode) {
    if (!domNode) return null;
    const key = Object.keys(domNode).find((k) => k.startsWith("__reactProps$"));
    return key ? domNode[key] : null;
  }

  function getItemId(el) {
    let fiber = getFiber(el);
    let depth = 0;
    while (fiber && depth < 20) {
      if (fiber.key && typeof fiber.key === "string" && fiber.key.length === 24) return fiber.key;
      if (fiber.memoizedProps?.item?._id) return fiber.memoizedProps.item._id;
      if (fiber.memoizedProps?.itemId) return fiber.memoizedProps.itemId;
      fiber = fiber.return;
      depth++;
    }
    return null;
  }

  function createSyntheticEvent(el) {
    return {
      nativeEvent: new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
      target: el,
      currentTarget: el,
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      preventDefault: () => {},
      stopPropagation: () => {},
      persist: () => {}
    };
  }

  // -----------------------------------------------------------
  // 4. Visibility & Clean Single Click
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

  // Dispatches exactly ONE clean MouseEvent sequence without duplicate triggers
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
    el.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
  }

  // -----------------------------------------------------------
  // 5. Weapon List & Knife Selection
  // -----------------------------------------------------------
  function expandWeaponsList() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']"));
    const showAllBtn = buttons.find((b) => {
      if (!isVisible(b)) return false;
      const t = (b.innerText || "").toLowerCase();
      return t.includes("show all") && t.includes("remaining");
    });
    if (showAllBtn) {
      console.log("[Dismantler] Expanding weapons list (Show all remaining)...");
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
        const fiber = getFiber(cur);
        if (fiber && fiber.memoizedProps && (fiber.memoizedProps.itemCode === "knife" || fiber.memoizedProps.item?.code === "knife")) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return node.parentElement || node;
    }

    const knifePaths = Array.from(document.querySelectorAll("svg path")).filter((p) => {
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

    const imgs = Array.from(document.querySelectorAll("img"));
    for (const img of imgs) {
      if (!isVisible(img)) continue;
      const srcStr = ((img.src || "") + " " + (img.alt || "") + " " + (img.srcset || "")).toLowerCase();
      if (srcStr.includes("knife.png") || srcStr.includes("/knife") || img.getAttribute("alt") === "knife") {
        const card = findClickableCard(img);
        if (card && isVisible(card) && !candidateTiles.includes(card)) {
          candidateTiles.push(card);
        }
      }
    }

    // Safety: Strictly filter out equipped items
    return candidateTiles.filter((tile) => {
      const text = (tile.innerText || tile.textContent || "").toLowerCase();
      if (text.includes("equip.") || text.includes("equipped")) return false;

      const fiber = getFiber(tile);
      if (fiber) {
        let f = fiber;
        let depth = 0;
        while (f && depth < 10) {
          if (f.memoizedProps && f.memoizedProps.isEquipped === true) return false;
          f = f.return;
          depth++;
        }
      }
      return true;
    });
  }

  // -----------------------------------------------------------
  // 6. Popover & Clean Single-Action Dismantle Trigger
  // -----------------------------------------------------------
  function getActivePopover() {
    const popovers = Array.from(document.querySelectorAll("._5hjs9w1, ._5hjs9w2, [data-floating-ui-portal]"));
    for (const p of popovers) {
      if (isVisible(p)) {
        const txt = (p.textContent || p.innerText || "").toLowerCase();
        if (txt.includes("dismantle")) return p;
      }
    }
    const allDivs = Array.from(document.querySelectorAll("div"));
    for (const div of allDivs) {
      if (!isVisible(div)) continue;
      const txt = (div.innerText || div.textContent || "").toLowerCase();
      if (txt.includes("dismantle") && txt.includes("sell")) {
        const style = window.getComputedStyle(div);
        if (style.position === "fixed" || style.position === "absolute") return div;
      }
    }
    return null;
  }

  /**
   * Single-Action Trigger:
   * Finds the Dismantle option and fires EXACTLY ONE trigger method,
   * then stops immediately to avoid hammering the server with duplicate mutations.
   */
  function triggerDismantle(popover, targetKnife) {
    if (popover) {
      const allDescendants = Array.from(popover.querySelectorAll("*"));
      const dismantleCandidates = allDescendants.filter((el) => {
        if (!isVisible(el)) return false;
        const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
        return txt.includes("dismantle") && !txt.includes("sell") && !txt.includes("equip");
      });

      if (dismantleCandidates.length > 0) {
        // Method A: Direct React Props onClick (cleanest single mutation)
        for (const el of dismantleCandidates) {
          const props = getReactProps(el);
          if (props && typeof props.onClick === "function") {
            try {
              props.onClick(createSyntheticEvent(el));
              return true; // STOP! Single action complete.
            } catch (err) {}
          }
        }

        // Method B: Fiber items array onClick
        for (const el of dismantleCandidates) {
          let fiber = getFiber(el);
          let depth = 0;
          while (fiber && depth < 20) {
            const props = fiber.memoizedProps;
            if (props && Array.isArray(props.items)) {
              const dItem = props.items.find((i) => i.key === "dismantle" || (i.label && i.label.toLowerCase().includes("dismantle")));
              if (dItem && typeof dItem.onClick === "function") {
                try {
                  dItem.onClick();
                  return true; // STOP!
                } catch (e) {}
              }
            }
            fiber = fiber.return;
            depth++;
          }
        }

        // Method C: Clean single DOM MouseEvent
        const targetEl = dismantleCandidates.find((el) => el.style?.cursor === "pointer" || el.classList?.contains("cursor-pointer")) || dismantleCandidates[0];
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, buttons: 1 };
          targetEl.dispatchEvent(new MouseEvent("mousedown", opts));
          targetEl.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
          targetEl.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
          return true; // STOP!
        }
      }
    }

    // Method D Fallback: Direct knife tile Fiber mutation
    if (targetKnife) {
      let fiber = getFiber(targetKnife);
      let depth = 0;
      while (fiber && depth < 25) {
        const props = fiber.memoizedProps;
        if (props && Array.isArray(props.items)) {
          const dItem = props.items.find((i) => i.key === "dismantle" || (i.label && i.label.toLowerCase().includes("dismantle")));
          if (dItem && typeof dItem.onClick === "function") {
            try {
              dItem.onClick();
              return true; // STOP!
            } catch (e) {}
          }
        }
        fiber = fiber.return;
        depth++;
      }
    }

    return false;
  }

  // -----------------------------------------------------------
  // 7. Confirmation Modal Handler (Rare+ Items)
  // -----------------------------------------------------------
  function triggerConfirm() {
    const modals = Array.from(document.querySelectorAll("[role='dialog'], [class*='modal'], [class*='dialog']"));
    const visibleModal = modals.find((m) => isVisible(m) && (m.innerText || "").includes("Dismantle Item"));

    let confirmBtn = null;
    if (visibleModal) {
      const buttons = Array.from(visibleModal.querySelectorAll("button, [role='button'], div"));
      confirmBtn = buttons.find((b) => {
        if (!isVisible(b)) return false;
        const txt = (b.textContent || b.innerText || "").trim().toLowerCase();
        return txt === "confirm" || (txt.includes("confirm") && !txt.includes("cancel"));
      });
    } else {
      const bodyTxt = document.body.innerText || "";
      if (bodyTxt.includes("Dismantle Item") || bodyTxt.includes("Are you sure you want to dismantle")) {
        const allBtns = Array.from(document.querySelectorAll("button, [role='button'], div"));
        confirmBtn = allBtns.find((b) => {
          if (!isVisible(b)) return false;
          const txt = (b.textContent || b.innerText || "").trim().toLowerCase();
          return txt === "confirm";
        });
      }
    }

    if (confirmBtn) {
      const props = getReactProps(confirmBtn);
      if (props && typeof props.onClick === "function") {
        try {
          props.onClick(createSyntheticEvent(confirmBtn));
          return true;
        } catch (e) {}
      }
      safeClick(confirmBtn);
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------
  // 8. Main Dismantle Loop (Human Pacing)
  // -----------------------------------------------------------
  (async function loop() {
    if (expandWeaponsList()) await sleep(600);

    let misses = 0;
    while (isStillActive() && confirmedDismantled < targetCount) {
      // If server asked to slow down, wait patiently until cooldown expires
      if (isThrottled) {
        console.log("[Dismantler] Throttled by server. Waiting for cooldown...");
        while (isThrottled && isStillActive()) {
          await sleep(500);
        }
        await sleep(1000);
        continue;
      }

      if ((document.body.innerText || "").toLowerCase().includes("please slow down")) {
        console.warn("[Dismantler] Screen contains rate-limit warning. Pausing 7s...");
        updateHUD("Rate limit paused (7s)...", true);
        await sleep(7000);
        continue;
      }

      const knives = getUnequippedKnives();
      const remainingCount = knives.length;

      if (remainingCount === 0) {
        if (++misses < 3) {
          expandWeaponsList();
          await sleep(800);
          continue;
        }
        console.log("%c[Dismantler] All unequipped knives dismantled!", "color: #10b981; font-weight: bold;");
        break;
      }
      misses = 0;

      const targetKnife = knives[0];
      const targetKnifeId = getItemId(targetKnife);
      const initialCount = remainingCount;
      const targetLabel = targetCount === Infinity ? "All" : targetCount;

      console.log(`[Dismantler] Found ${remainingCount} knives. Opening menu on knife #1...`);

      let popover = getActivePopover();
      if (!popover) {
        updateHUD(`Opening menu... (${confirmedDismantled}/${targetLabel}) [${remainingCount} knives left]`);
        safeClick(targetKnife);

        const openStart = Date.now();
        while (Date.now() - openStart < 2000) {
          if (!isStillActive()) return;
          await sleep(100);
          popover = getActivePopover();
          if (popover) break;
        }
      }

      if (!popover) {
        const inner = targetKnife.querySelector("svg, img");
        if (inner) safeClick(inner);

        const openStart2 = Date.now();
        while (Date.now() - openStart2 < 1500) {
          if (!isStillActive()) return;
          await sleep(100);
          popover = getActivePopover();
          if (popover) break;
        }
      }

      if (!isStillActive()) return;

      updateHUD(`Dismantling knife... (${confirmedDismantled}/${targetLabel})`);

      // Gentle pause before clicking dismantle (natural human delay)
      await sleep(250 + Math.random() * 200);

      // Execute exactly ONE trigger action
      let triggered = triggerDismantle(popover, targetKnife);
      if (!triggered) {
        triggered = triggerDismantle(null, targetKnife);
      }

      if (!triggered) {
        console.warn("[Dismantler] Trigger failed on knife. Retrying next tick...");
        await sleep(800);
        continue;
      }

      // Check for confirmation modal (if item is Rare+)
      for (let i = 0; i < 3; i++) {
        if (!isStillActive()) return;
        await sleep(150);
        if (triggerConfirm()) break;
      }

      // Await server response and deduction detection
      const actionTime = Date.now();
      let deductionDetected = false;
      while (Date.now() - actionTime < 2500) {
        if (!isStillActive()) return;
        await sleep(150);

        if (isThrottled) break;
        triggerConfirm();

        if (!document.body.contains(targetKnife)) {
          deductionDetected = true;
          break;
        }

        if (targetKnifeId) {
          const currentKnives = getUnequippedKnives();
          const exists = currentKnives.some((k) => getItemId(k) === targetKnifeId);
          if (!exists) {
            deductionDetected = true;
            break;
          }
        }

        const toasts = Array.from(document.querySelectorAll("[class*='toast'], [role='status'], [role='alert'], div"));
        const hasToast = toasts.some((t) => isVisible(t) && (t.innerText || "").toLowerCase().includes("item dismantled"));
        if (hasToast) {
          deductionDetected = true;
          break;
        }
      }

      confirmedDismantled++;
      const left = Math.max(0, initialCount - 1);
      updateHUD(`Dismantled ${confirmedDismantled}/${targetLabel} (${left} left)`);
      console.log(
        `%c[Dismantler] Dismantled: ${confirmedDismantled}/${targetLabel} (status: ${deductionDetected ? "confirmed" : "dispatched"})`,
        "color: #10b981; font-weight: bold;"
      );

      // Hard stop on target reach
      if (confirmedDismantled >= targetCount) {
        console.log(
          `%c[Dismantler] Reached target (${confirmedDismantled}/${targetCount}). Stopping successfully!`,
          "color: #10b981; font-weight: bold; font-size: 13px;"
        );
        window.stopDismantler();
        break;
      }

      // Natural human pause between dismantling items (~2.1s - 2.8s + adaptive backoff)
      const jitter = (Math.random() - 0.5) * 500;
      const delay = Math.max(2000, baseInterval + throttleBackoff + jitter);
      await sleep(delay);
    }

    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`🎉 Finished: ${confirmedDismantled}/${targetLabel} knives dismantled`);
    window.stopDismantler();
  })();
})();
