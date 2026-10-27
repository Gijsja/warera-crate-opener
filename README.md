# War Era Automation Tools 📦🔪

Lightweight, safe browser automation scripts for [War Era](https://app.warera.io) that bypass the need for paid supporter bulk actions by performing humanized single-action automation directly from your browser console.

---

## 1. Safe Crate Opener (`opener.js`) 📦

Auto-opens inventory crates and loot boxes one by one with server-confirmed deduction counting.

### Usage
1. Open your inventory on [app.warera.io](https://app.warera.io).
2. Press **`F12`** (or **`Ctrl + Shift + K`** in Firefox / **`Ctrl + Shift + J`** in Chrome) to open the Console.
3. Copy the code in **[`opener.js`](opener.js)**, paste it into the console, and press **Enter**.
4. Enter how many crates you want to open (e.g. `10`, `30`, or `all`).

- **Stop anytime**: Click the floating red **`[⏹ STOP]`** button on screen, press **`Esc`**, or run `stopOpener()` in the console.

---

## 2. Safe Inventory Knife Dismantler (`dismantler.js`) 🔪

Auto-dismantles low-tier crate-drop knives for scraps without accidentally scrapping equipped gear, tanks, rifles, or pistols.

### Usage
1. Open your inventory on [app.warera.io](https://app.warera.io).
2. Open the Console (**`F12`** or **`Ctrl + Shift + K`** in Firefox).
3. Copy the code in **[`dismantler.js`](dismantler.js)**, paste it into the console, and press **Enter**.
4. Enter how many knives to dismantle (default: `1`, or enter a custom number like `10`, `25`, or `all`).

- **Stop anytime**: Click the floating red **`[⏹ STOP]`** button on screen, press **`Esc`**, or run `stopDismantler()` in the console.

---

## Safety & Anti-Detection Features

- **Strict Target Filtering**: The dismantler only targets knife assets (`knife.png` / knife icon SVG) and strictly ignores any item with the `Equip.` badge, protecting all your tanks, guns, rifles, and equipped gear.
- **Auto-Expansion**: Automatically clicks `"Show all"` if your weapons list is collapsed so all knives in inventory are visible.
- **Confirmed Deduction Tracking**: Watches the DOM and server-confirmed state before incrementing the counter, ensuring no false counts during animations or network lag.
- **Pure MouseEvents & Pointer Capture Guard**: Uses clean synthetic `MouseEvent` sequences (`mousedown`, `mouseup`, `click`) and safe pointer capture guards to eliminate React 18 / Next.js `Element.setPointerCapture` pointer crash bugs.
- **Single-Action Trigger (Anti-Hammering)**: Fires exactly one clean dismantle action per knife, eliminating duplicate click spamming and server burst limits.
- **Humanized Cadence & Anti-Bot Jitter**: Randomized spatial click coordinates within button boundaries and natural delays (~2.2s – 2.8s) matching human speed.
- **Adaptive Rate-Limit Cooldown**: Automatically pauses for 7 seconds to allow server rate-limit buckets to fully reset if a `"Please slow down"` notice appears.
- **Interactive Status HUD**: Displays an on-screen floating pill showing real-time progress, an emergency `[ESC]` shortcut, and an instant clickable red `[⏹ STOP]` button.
