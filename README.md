# 🛡️ CleanTube — Ad Blocker for YouTube™ (Manifest V3)

CleanTube is an open-source, lightweight Chrome extension engineered specifically to eliminate YouTube advertisements without telemetry tracking, data harvesting, or unnecessary permissions.

---

## 🌟 Key Features

### 1. Parity with Rival Extension ("Adblock for YouTube™")
- **Pre-Roll, Mid-Roll, and Post-Roll Ad Blocking**: Fast-forwards and auto-skips video advertisements.
- **Auto-Click "Skip Ad"**: Clicks skip buttons instantly when rendered.
- **Cosmetic Filtering**: Strips banners, companion side-rail units, and homepage masthead promos.
- **Embedded Player Support**: Compatible with embedded YouTube frames across external websites.
- **Live Stream Compatibility**: Keeps live streams uninterrupted.
- **Annotation & Card Removal**: Toggleable suppression of interactive end cards.

### 2. Exclusive Enhancements (Beyond Rival)
- 🔒 **Privacy-First Minimal Permissions**: Only requests `*.youtube.com` host permissions instead of dangerous `<all_urls>` wildcards.
- ⚡ **Main World Interception (`injected.js`)**: Sanitizes `ytInitialPlayerResponse` and player fetch payloads to strip ad placements before video initialization.
- 🎯 **Channel Whitelisting**: Allows selective whitelisting of your favorite creators to support them while keeping other channels ad-free.
- 📊 **Real-time Statistics**: Tracks ads blocked today, total blocked count, and estimated watch time saved.
- 🏷️ **Dynamic Badge Counter**: Displays current session block counts directly on the extension icon.
- ⌨️ **Keyboard Shortcut**: Quick toggle via `Alt+Shift+B`.
- ⚙️ **Full Options Dashboard**: Granular feature controls and JSON configuration backup/restore.

---

## 🚀 How to Install & Load in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** via the toggle switch in the upper-right corner.
3. Click the **Load unpacked** button.
4. Select the `cleantube` directory:
   ```
   F:\My Creation\extensionDev\cleantube
   ```
5. CleanTube will appear in your extension list with its blue shield icon. Pin it to your toolbar for easy access.

---

## 🧪 Testing & Validation

Run the integrated automated test suite:
```bash
cd "F:\My Creation\extensionDev\cleantube"
node tests/run-tests.js
```
All 12 test assertions validate the manifest structure, network declarative rules, script hooks, and interface files.

