# War Era Crate Opener 📦

A lightweight, safe browser script to auto-open loot boxes one-by-one in [War Era](https://app.warera.io).

## Quick Start

1. Go to your inventory in [app.warera.io](https://app.warera.io)
2. Press **`F12`** (or **`Ctrl + Shift + K`** in Firefox / **`Ctrl + Shift + J`** in Chrome) to open the Console.
3. Copy the code in **[`opener.js`](opener.js)**, paste it into the console, and press **Enter**.
4. Enter how many crates you want to open (e.g. `10`).

That's it! A floating status HUD will appear at the top of your screen showing live progress.

---

## Controls

- **Cancel anytime**: Press **`Esc`** on your keyboard, or type `stopOpener()` in the console.

---

## Safety Features

- **Confirmed Deduction Tracking**: Watches the actual badge count ($30 \rightarrow 29$) before incrementing the counter. Never miscounts during lag or animation reels.
- **Auto-Reopening**: If the modal is closed, it automatically locates and clicks the crate in your inventory.
- **Pure MouseEvents**: Eliminates React 18 / Next.js `Element.setPointerCapture` pointer crash bugs.
- **Anti-Bot Click Jitter**: Randomized click coordinates inside the button and natural bounce cadences (~1.8s).
- **Rate-Limit Backoff**: Automatically pauses for 4 seconds if the game displays `"Please slow down"`.
- **Single Open Only**: Strictly avoids "Open All" or Supporter bulk buttons.
