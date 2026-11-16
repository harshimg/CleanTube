# 🛡️ CleanTube — Ad Blocker for YouTube™ (Manifest V3)

CleanTube is a lightweight, privacy-focused Chrome extension engineered to eliminate YouTube advertisements without telemetry tracking, data harvesting, or unnecessary permissions.

---

## 🌟 Key Features

- **Comprehensive Video Ad Blocking**: Fast-forwards and auto-skips pre-roll, mid-roll, and post-roll video advertisements.
- **Instant Skip**: Automatically clicks modern YouTube "Skip Ad" buttons immediately upon rendering.
- **Cosmetic Filtering**: Eliminates banners, sidebar companion ads, and feed layout gaps with zero black boxes.
- **Main World Scriptlet Engine**: Sanitizes video response payloads before playback begins.
- **Creator Whitelisting**: Selectively whitelist your favorite creators to support them while keeping the rest of YouTube ad-free.
- **Live Statistics**: Displays real-time counts of blocked ads and estimated time saved.
- **Dynamic Badge Counter**: Shows blocked ad counts directly on the toolbar icon.
- **Privacy-First**: Zero analytics, zero data logging, and permissions strictly scoped to YouTube (`*.youtube.com`).

---

## 🚀 How to Install

### Option 1: Chrome Web Store (Recommended)

Get CleanTube directly on Google Chrome with automatic updates:

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install_CleanTube-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://noink.ink/cleantube)

👉 **Direct Link**: [https://noink.ink/cleantube](https://noink.ink/cleantube)

---

### Option 2: From Source (Developer Mode)

1. Clone this repository or download the source code:
   ```bash
   git clone https://github.com/harshimg/CleanTube.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** via the toggle switch in the upper-right corner.
4. Click the **Load unpacked** button.
5. Select the `projects/cleantube` directory containing `manifest.json`.
6. CleanTube will appear in your extension list with its red shield icon. Pin it to your toolbar for easy access!

---

## 🧪 Testing & Validation

Run the automated test suite locally:
```bash
node tests/run-tests.js
```
Validates the manifest structure, declarative net request rules, script hooks, and interface files.

---

## 📄 License & Privacy

- **Privacy Policy**: CleanTube does not collect, transmit, or monetize any user data.
- **Publisher**: Daarks (`daarks.com`)
