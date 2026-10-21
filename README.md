# War Era Safe Crate Opener 📦

A humanized, safe single-case auto-opener for **War Era** ([app.warera.io](https://app.warera.io)).

Designed to prevent anti-bot bans, avoid rate-limit locks, and eliminate UI crashes.

---

## Key Features

- **Confirmed Deduction Counting**: Tracks the actual badge deduction on the server ($30 \rightarrow 29$) before counting an opened box.
- **Auto-Reopening**: If the "OPEN CASE" modal is closed, it automatically locates and clicks the crate in your inventory to open the modal.
- **Anti-Bot Click Variance**: Uses triangular Gaussian-like coordinate divergence inside the inner 60% of buttons and realistic bounce cadences (~1.8s).
- **Adaptive Rate-Limit Throttling**: Listens for the game's `"Please slow down"` toast and pauses dynamically for 4 seconds.
- **Pure MouseEvents**: Completely avoids Next.js/React 18 `Element.setPointerCapture: Invalid pointer id` synthetic pointer crashes.
- **In-Game Floating HUD**: Displays live status (`📦 Opened 4/10 (Stock: 26) [ESC to cancel]`) directly on your game screen.
- **Emergency Stop**: Press **`Esc`** on your keyboard anytime in-game to immediately halt opening.

---

## Installation Options

Choose whichever method you prefer:

### Option 1: Browser Extension (Recommended)
Works on **Firefox, Chrome, Brave, and Edge**.

#### In Firefox:
1. Open a new tab and go to: `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Select `extension/manifest.json` from this repository.
4. The 📦 icon appears in your toolbar. Open War Era, click the icon, pick a preset (`5`, `10`, `25`, `50`), and click **▶ Start Opening**.

#### In Chrome / Brave / Edge:
1. Open a new tab and navigate to: `chrome://extensions`
2. Enable **"Developer mode"** in the top-right corner.
3. Click **"Load unpacked"** and select the `extension/` folder from this repository.
4. Pin the 📦 icon to your toolbar and click it on War Era.

---

### Option 2: 1-Click Bookmarklet (Zero Installation)
Works in **any browser** with no developer mode needed.

1. Press **`Ctrl + Shift + O`** (or open your browser's Bookmark Manager).
2. Create a new bookmark:
   - **Name**: `📦 Open Crates`
   - **URL**: Copy the contents of [`bookmarklet/bookmarklet.txt`](./bookmarklet/bookmarklet.txt) (or copy below):

```javascript
javascript:(function(){const s=document.createElement('script');s.textContent=`(${document.getElementById('warera-script')?window.stopOpener():(function(){let b=1800,r=0,c=0,t=parseInt(prompt("How many boxes to open?","10"),10);if(isNaN(t)||t<=0)return;let o=new MutationObserver(m=>{for(let x of m){for(let n of x.addedNodes){if(n.nodeType===1&&(n.innerText||'').toLowerCase().includes('slow down')){r=1;setTimeout(()=>r=0,4000);}}}});o.observe(document.body,{childList:true,subtree:true});function sc(e){if(!e)return;let rc=e.getBoundingClientRect(),x=rc.left+rc.width*(0.3+Math.random()*0.4),y=rc.top+rc.height*(0.3+Math.random()*0.4),p={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y};e.dispatchEvent(new MouseEvent('mousedown',p));setTimeout(()=>{e.dispatchEvent(new MouseEvent('mouseup',p));e.dispatchEvent(new MouseEvent('click',p));},50);}function gB(){return Array.from(document.querySelectorAll("button,[role='button']")).find(b=>b.offsetParent!==null&&!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&(b.innerText||'').toLowerCase().includes('open case')&&!['supporter','open 10','open 5','open all'].some(k=>(b.innerText||'').toLowerCase().includes(k)));}function gC(){let b=gB();if(!b)return null;let m=(b.innerText||'').match(/\\d+/);return m?parseInt(m[0],10):null;}function gI(){let imgs=Array.from(document.querySelectorAll('img')).find(i=>i.offsetParent!==null&&['case','crate','box','loot'].some(k=>((i.src||'')+' '+(i.alt||'')).toLowerCase().includes(k)));if(imgs)return imgs.closest("button,[role='button'],div.cursor-pointer")||imgs.parentElement;return document.querySelector("[class*='inventory'] [class*='grid']>div");}window.stopOpener=()=>{c=t;o.disconnect();console.log('[Opener] Stopped.');};window.addEventListener('keydown',e=>{if(e.key==='Escape')window.stopOpener();},{once:true});(async function l(){while(c<t){if(r){await new Promise(w=>setTimeout(w,500));continue;}let btn=gB();if(btn){let cb=gC();sc(btn);let st=Date.now(),ok=false;while(Date.now()-st<7000){await new Promise(w=>setTimeout(w,200));let cur=gC();if(cur!==null&&cur<cb){ok=true;break;}}if(ok){c++;console.log('[Opener] Confirmed '+c+'/'+t);}await new Promise(w=>setTimeout(w,Math.max(1400,b+(Math.random()-0.5)*400)));continue;}let cr=gI();if(cr){sc(cr);await new Promise(w=>setTimeout(w,1500));continue;}break;}console.log('[Opener] Finished '+c+'/'+t);})();})})()`;document.body.appendChild(s);})();
```

3. Whenever you are on `https://app.warera.io`, click the bookmark in your bookmark bar, enter your target count, and it runs immediately!

---

### Option 3: Userscript (Tampermonkey / Violentmonkey)

If you already use a userscript manager:
1. Open Tampermonkey or Violentmonkey.
2. Create a new script and paste the contents of [`userscript/warera-opener.user.js`](./userscript/warera-opener.user.js).
3. Save the script.
4. When you visit `app.warera.io`, an **"📦 Open Crates"** button will be pinned to the bottom-right of your screen. Click it anytime to open crates!

---

## Repository Structure

```text
warera-crate-opener/
├── README.md                          # User documentation & guide
├── extension/                         # Manifest V3 Extension
│   ├── manifest.json                  # Extension configuration
│   ├── popup.html                     # Popup interface
│   ├── popup.js                       # Logic & in-page injector
│   └── icons/                         # 16px, 48px, 128px PNG icons
├── bookmarklet/
│   ├── source.js                      # Formatted readable source
│   └── bookmarklet.txt                # 1-line bookmarklet code
└── userscript/
    └── warera-opener.user.js          # Tampermonkey / Violentmonkey script
```

---

## Safety Guidelines

- **Single Open Only**: Strictly avoids bulk/supporter buttons ("OPEN 10 Supporter", "OPEN 5 Supporter", "Open All").
- **Humanized Jitter**: Does not click at a robotic fixed frequency; incorporates realistic human reaction delays.
- **Cancellation**: Press **`Esc`** at any second if you need to stop.
