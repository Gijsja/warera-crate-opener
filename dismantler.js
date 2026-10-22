/**
 * War Era Rock-Solid Inventory Knife Dismantler
 * https://app.warera.io
 *
 * Fully verified multi-layer auto-dismantler targeting crate-drop knives:
 * - Specific Target: Knives only (SVG path 'M22,2L17.39...', 'knife.png', or Fiber item.code === 'knife')
 * - Safety Shield: Strictly excludes all equipped items, pistols, rifles, tanks, and armor
 * - Multi-Layer Dismantle Trigger:
 *     Layer 1: High-fidelity DOM Pointer & MouseEvent dispatch (pointerdown, mousedown, pointerup, mouseup, click)
 *     Layer 2: Native Element .click() on target and ancestors
 *     Layer 3: Direct React Props (__reactProps$) onClick invocation with synthetic event object
 *     Layer 4: Direct React Fiber (__reactFiber$) hook & mutation invocation from popover or knife tile (eu.Ay)
 * - Reliable Popover & Confirm Detection: Floating-UI portal (_5hjs9w1/_5hjs9w2) + confirmation modal handling
 * - Confirmed Deduction Verification: Awaits DOM removal and inventory count decrement before next action
 * - Anti-Bot & Throttling: Spatial divergence, randomized human cadence (1.4s - 1.8s), adaptive rate-limit pause
 * - Interactive HUD with live progress & Instant 'Esc' / stopDismantler() cancellation
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

  console.log(
    `%c[Dismantler] Target: ${targetCount === Infinity ? "ALL" : targetCount} knives. Initializing multi-layer engine...`,
    "color: #10b981; font-weight: bold; font-size: 13px;"
  );

  // -----------------------------------------------------------
  // 1. Floating On-Screen HUD
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
  // 2. Adaptive Throttle Watcher ("Please slow down")
  // -----------------------------------------------------------
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const txt = (node.innerText || "").toLowerCase();
          if (txt.includes("slow down") || txt.includes("please slow down")) {
            console.warn(`[Dismantler] Rate limit detected. Pausing 4s...`);
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
  // 4. Visibility & Click Helpers
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
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons: 1 };

    if (typeof window.PointerEvent === "function") {
      el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse", isPrimary: true }));
    }
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    if (typeof window.PointerEvent === "function") {
      el.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0, pointerType: "mouse", isPrimary: true }));
    }
    el.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));

    // Trigger React onClick prop if present
    const props = getReactProps(el);
    if (props && typeof props.onClick === "function") {
      try {
        props.onClick(createSyntheticEvent(el));
      } catch (e) {}
    }

    if (typeof el.click === "function") el.click();
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
      const props = getReactProps(showAllBtn);
      if (props && typeof props.onClick === "function") {
        try {
          props.onClick(createSyntheticEvent(showAllBtn));
        } catch (e) {}
      }
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

    // 1. Search SVG icons with knife path (M22,2L17.39...)
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

    // 2. Search <img> tags containing "knife.png", "/itemsv2/knife", or alt="knife"
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

    // SAFETY: Strictly filter out equipped items
    return candidateTiles.filter((tile) => {
      const text = (tile.innerText || tile.textContent || "").toLowerCase();
      if (text.includes("equip.") || text.includes("equipped")) return false;

      // React Fiber safety check: ensure isEquipped is not true
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
  // 6. Popover & Dismantle Triggering
  // -----------------------------------------------------------
  function getActivePopover() {
    // Strategy A: Floating-UI portal classes
    const popovers = Array.from(document.querySelectorAll("._5hjs9w1, ._5hjs9w2, [data-floating-ui-portal]"));
    for (const p of popovers) {
      if (isVisible(p)) {
        const txt = (p.textContent || p.innerText || "").toLowerCase();
        if (txt.includes("dismantle")) return p;
      }
    }

    // Strategy B: Any visible fixed/absolute container with both "Dismantle" and "Sell"
    const allDivs = Array.from(document.querySelectorAll("div"));
    for (const div of allDivs) {
      if (!isVisible(div)) continue;
      const txt = (div.innerText || div.textContent || "").toLowerCase();
      if (txt.includes("dismantle") && txt.includes("sell")) {
        const style = window.getComputedStyle(div);
        if (style.position === "fixed" || style.position === "absolute") {
          return div;
        }
      }
    }

    return null;
  }

  /**
   * Multi-layer Dismantle Trigger Mechanism:
   * Layer 1: High-fidelity Mouse/Pointer event sequence
   * Layer 2: Native Element .click() on target and ancestors
   * Layer 3: Direct __reactProps$.onClick invocation with synthetic event
   * Layer 4: Direct __reactFiber$ traversal of popover component or knife tile
   */
  function triggerDismantle(popover, targetKnife) {
    let triggered = false;

    if (popover) {
      const allDescendants = Array.from(popover.querySelectorAll("*"));

      // CRITICAL FIX: Match elements belonging strictly to the Dismantle row.
      // Must include "dismantle" AND exclude "sell" and "equip" to avoid selecting the outer menu container!
      const dismantleCandidates = allDescendants.filter((el) => {
        if (!isVisible(el)) return false;
        const txt = (el.innerText || el.textContent || "").trim().toLowerCase();
        return txt.includes("dismantle") && !txt.includes("sell") && !txt.includes("equip");
      });

      if (dismantleCandidates.length > 0) {
        // Find row element: first check candidate with __reactProps$.onClick
        let rowEl = dismantleCandidates.find((el) => {
          const props = getReactProps(el);
          return props && typeof props.onClick === "function";
        });

        // Fallback: candidate with cursor: pointer or cursor-pointer class
        if (!rowEl) {
          rowEl = dismantleCandidates.find((el) => el.style?.cursor === "pointer" || el.classList?.contains("cursor-pointer"));
        }

        // Fallback: container element (largest candidate)
        if (!rowEl) {
          rowEl = dismantleCandidates[dismantleCandidates.length - 1];
        }

        // Leaf text element (element with shortest non-empty text, e.g. "Dismantle")
        const leafEl = dismantleCandidates.reduce((shortest, el) => {
          const len = (el.textContent || "").trim().length;
          return len > 0 && len < (shortest.textContent || "").trim().length ? el : shortest;
        }, dismantleCandidates[0]);

        const targets = [rowEl, leafEl].filter(Boolean);

        // -------------------------------------------------------------
        // LAYER 1: DOM Event Dispatch (Pointer & Mouse Event Sequence)
        // -------------------------------------------------------------
        for (const target of targets) {
          const rect = target.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy,
            buttons: 1
          };

          if (typeof window.PointerEvent === "function") {
            target.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse", isPrimary: true }));
          }
          target.dispatchEvent(new MouseEvent("mousedown", opts));
          if (typeof window.PointerEvent === "function") {
            target.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0, pointerType: "mouse", isPrimary: true }));
          }
          target.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
          target.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
        }

        // -------------------------------------------------------------
        // LAYER 2: Native Element Click (.click())
        // -------------------------------------------------------------
        for (const target of targets) {
          let cur = target;
          while (cur && cur !== popover) {
            if (typeof cur.click === "function") {
              try {
                cur.click();
                triggered = true;
              } catch (e) {}
            }
            cur = cur.parentElement;
          }
        }

        // -------------------------------------------------------------
        // LAYER 3: Direct React Props Trigger (__reactProps$)
        // -------------------------------------------------------------
        for (const target of targets) {
          let cur = target;
          while (cur && cur !== popover) {
            const props = getReactProps(cur);
            if (props && typeof props.onClick === "function") {
              try {
                console.log("[Dismantler] Layer 3: Invoking __reactProps$.onClick directly on Dismantle element");
                props.onClick(createSyntheticEvent(cur));
                triggered = true;
                break;
              } catch (err) {
                console.warn("[Dismantler] Layer 3 error:", err);
              }
            }
            cur = cur.parentElement;
          }
          if (triggered) break;
        }

        // -------------------------------------------------------------
        // LAYER 4: React Fiber Popover Traversal (__reactFiber$)
        // -------------------------------------------------------------
        for (const target of targets) {
          let fiber = getFiber(target);
          let depth = 0;
          while (fiber && depth < 20) {
            const props = fiber.memoizedProps;
            if (props) {
              // Direct Dismantle menu item component (component A in Module 71651)
              if ((props.label === "Dismantle" || props.key === "dismantle") && typeof props.onClick === "function") {
                console.log("[Dismantler] Layer 4: Invoked onClick from popover item Fiber (component A)");
                try {
                  props.onClick();
                  if (typeof props.closeMenu === "function") props.closeMenu();
                  triggered = true;
                  break;
                } catch (e) {
                  console.warn("[Dismantler] Layer 4 popover fiber error:", e);
                }
              }

              // Popover items array
              if (Array.isArray(props.items)) {
                const dItem = props.items.find((i) => i.key === "dismantle" || (i.label && i.label.toLowerCase().includes("dismantle")));
                if (dItem && typeof dItem.onClick === "function") {
                  console.log("[Dismantler] Layer 4: Invoked onClick from popover items array Fiber");
                  try {
                    dItem.onClick();
                    triggered = true;
                    break;
                  } catch (e) {
                    console.warn("[Dismantler] Layer 4 items array error:", e);
                  }
                }
              }
            }
            fiber = fiber.return;
            depth++;
          }
          if (triggered) break;
        }
      }
    }

    // -----------------------------------------------------------------
    // LAYER 4 Fallback: Direct Knife Tile Fiber Traversal
    // -----------------------------------------------------------------
    if (!triggered && targetKnife) {
      console.log("[Dismantler] Layer 4 Fallback: Traversing Fiber from knife tile directly...");
      let fiber = getFiber(targetKnife);
      let depth = 0;
      while (fiber && depth < 25) {
        const props = fiber.memoizedProps;
        if (props && Array.isArray(props.items)) {
          const dItem = props.items.find((i) => i.key === "dismantle" || (i.label && i.label.toLowerCase().includes("dismantle")));
          if (dItem && typeof dItem.onClick === "function") {
            console.log("[Dismantler] Layer 4 Fallback: Invoked onClick from knife tile Fiber (eu.Ay)");
            try {
              dItem.onClick();
              triggered = true;
              break;
            } catch (e) {
              console.warn("[Dismantler] Layer 4 knife tile fiber fallback error:", e);
            }
          }
        }
        fiber = fiber.return;
        depth++;
      }
    }

    return triggered;
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
      console.log("[Dismantler] Confirm modal detected. Confirming dismantle...");
      const props = getReactProps(confirmBtn);
      if (props && typeof props.onClick === "function") {
        try {
          props.onClick(createSyntheticEvent(confirmBtn));
        } catch (e) {}
      }
      confirmBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      confirmBtn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (typeof confirmBtn.click === "function") confirmBtn.click();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------
  // 8. Main Dismantle Loop
  // -----------------------------------------------------------
  (async function loop() {
    if (expandWeaponsList()) await new Promise((r) => setTimeout(r, 600));

    let misses = 0;
    while (isRunning && confirmedDismantled < targetCount) {
      if (isThrottled) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Pre-check for rate-limiting notices on screen
      if ((document.body.innerText || "").toLowerCase().includes("please slow down")) {
        console.warn("[Dismantler] Screen contains rate-limit warning. Pausing 3s...");
        updateHUD("Rate limit paused (3s)...", true);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const knives = getUnequippedKnives();
      const remainingCount = knives.length;

      if (remainingCount === 0) {
        if (++misses < 3) {
          expandWeaponsList();
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        console.log("%c[Dismantler] All knives dismantled!", "color: #10b981; font-weight: bold;");
        break;
      }
      misses = 0;

      const targetKnife = knives[0];
      const initialCount = remainingCount;
      const targetLabel = targetCount === Infinity ? "All" : targetCount;

      console.log(`[Dismantler] Found ${remainingCount} knives. Checking popover status...`);

      // Check if popover is already open on screen
      let popover = getActivePopover();
      if (!popover) {
        updateHUD(`Opening menu... (${confirmedDismantled}/${targetLabel}) [${remainingCount} knives left]`);
        safeClick(targetKnife);

        const openStart = Date.now();
        while (Date.now() - openStart < 2000) {
          await new Promise((r) => setTimeout(r, 100));
          popover = getActivePopover();
          if (popover) break;
        }
      }

      if (!popover) {
        // Retry clicking inner SVG or IMG
        const inner = targetKnife.querySelector("svg, img");
        if (inner) safeClick(inner);

        const openStart2 = Date.now();
        while (Date.now() - openStart2 < 1500) {
          await new Promise((r) => setTimeout(r, 100));
          popover = getActivePopover();
          if (popover) break;
        }
      }

      console.log(`[Dismantler] Popover state: ${popover ? "OPEN" : "CLOSED"}. Triggering Dismantle...`);
      updateHUD(`Dismantling knife... (${confirmedDismantled}/${targetLabel})`);

      let triggered = triggerDismantle(popover, targetKnife);
      if (!triggered) {
        console.warn("[Dismantler] Could not trigger via popover. Attempting direct Fiber mutation...");
        triggered = triggerDismantle(null, targetKnife);
      }

      if (!triggered) {
        console.warn("[Dismantler] All trigger layers failed on knife. Retrying next tick...");
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      // Check for confirmation modal (if item is Rare+)
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 120));
        if (triggerConfirm()) break;
      }

      // Wait for confirmed removal of the knife from inventory
      const actionTime = Date.now();
      let confirmed = false;
      while (Date.now() - actionTime < 4500) {
        await new Promise((r) => setTimeout(r, 200));

        if (isThrottled) break;

        // Check if confirm modal appeared late
        triggerConfirm();

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
        console.log(
          `%c[Dismantler] Confirmed dismantled: ${confirmedDismantled}/${targetLabel} (${left} left)`,
          "color: #10b981; font-weight: bold;"
        );
      } else {
        console.warn("[Dismantler] Dismantle deduction took longer or missed. Retrying next tick...");
      }

      const jitter = (Math.random() - 0.5) * 400;
      await new Promise((r) => setTimeout(r, Math.max(1200, baseInterval + jitter)));
    }

    const targetLabel = targetCount === Infinity ? "All" : targetCount;
    closeHUD(`🎉 Finished: ${confirmedDismantled}/${targetLabel} knives dismantled`);
    window.stopDismantler();
  })();
})();
