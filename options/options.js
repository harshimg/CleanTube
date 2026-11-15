/**
 * CleanTube - Options Page Logic
 * Configures granular preferences, handles whitelist management, and manages export/import operations.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const prefAutoSkip = document.getElementById('pref-auto-skip');
  const prefOverlays = document.getElementById('pref-overlays');
  const prefCompanion = document.getElementById('pref-companion');
  const prefInFeed = document.getElementById('pref-infeed');
  const prefAnnotations = document.getElementById('pref-annotations');

  const whitelistInput = document.getElementById('whitelist-input');
  const addWhitelistBtn = document.getElementById('add-whitelist-btn');
  const whitelistContainer = document.getElementById('whitelist-container');

  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');
  const resetStatsBtn = document.getElementById('reset-stats-btn');

  let currentSettings = {};
  let currentWhitelist = [];

  // Render whitelist tag chips
  function renderWhitelist() {
    whitelistContainer.innerHTML = '';
    if (!currentWhitelist || currentWhitelist.length === 0) {
      whitelistContainer.innerHTML = '<span class="no-whitelist">No channels whitelisted yet.</span>';
      return;
    }

    currentWhitelist.forEach((channel, index) => {
      const tag = document.createElement('div');
      tag.className = 'whitelist-tag';
      tag.innerHTML = `
        <span>${channel}</span>
        <button class="remove-tag" data-index="${index}" title="Remove">&times;</button>
      `;
      whitelistContainer.appendChild(tag);
    });

    // Attach click listeners to delete tags
    whitelistContainer.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        currentWhitelist.splice(idx, 1);
        await chrome.storage.local.set({ whitelist: currentWhitelist });
        chrome.runtime.sendMessage({ action: 'updateWhitelist', whitelist: currentWhitelist });
        renderWhitelist();
      });
    });
  }

  // 1. Load initial options state from chrome.storage
  const data = await chrome.storage.local.get(['settings', 'whitelist']);
  currentSettings = data.settings || {};
  currentWhitelist = data.whitelist || [];

  prefAutoSkip.checked = currentSettings.autoSkip !== false;
  prefOverlays.checked = currentSettings.blockOverlays !== false;
  prefCompanion.checked = currentSettings.blockCompanion !== false;
  prefInFeed.checked = currentSettings.blockInFeed !== false;
  prefAnnotations.checked = currentSettings.blockAnnotations !== false;

  renderWhitelist();

  // 2. Setting change listener helper
  function saveSettings() {
    currentSettings.autoSkip = prefAutoSkip.checked;
    currentSettings.blockOverlays = prefOverlays.checked;
    currentSettings.blockCompanion = prefCompanion.checked;
    currentSettings.blockInFeed = prefInFeed.checked;
    currentSettings.blockAnnotations = prefAnnotations.checked;

    chrome.storage.local.set({ settings: currentSettings });
    chrome.runtime.sendMessage({ action: 'updateSettings', settings: currentSettings });
  }

  [prefAutoSkip, prefOverlays, prefCompanion, prefInFeed, prefAnnotations].forEach(toggle => {
    toggle.addEventListener('change', saveSettings);
  });

  // 3. Add to whitelist
  function addChannel() {
    let val = whitelistInput.value.trim();
    if (!val) return;
    if (!val.startsWith('@') && !val.startsWith('http')) {
      val = `@${val}`;
    }

    if (!currentWhitelist.includes(val)) {
      currentWhitelist.push(val);
      chrome.storage.local.set({ whitelist: currentWhitelist });
      chrome.runtime.sendMessage({ action: 'updateWhitelist', whitelist: currentWhitelist });
      renderWhitelist();
    }
    whitelistInput.value = '';
  }

  addWhitelistBtn.addEventListener('click', addChannel);
  whitelistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addChannel();
  });

  // 4. Export Settings & Statistics
  exportBtn.addEventListener('click', async () => {
    const allData = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleantube-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 5. Import Settings
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (typeof imported === 'object' && imported !== null) {
          await chrome.storage.local.set(imported);
          alert('Settings successfully imported! Reloading preferences.');
          window.location.reload();
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // 6. Reset Statistics
  resetStatsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all ad counters to zero?')) {
      chrome.runtime.sendMessage({ action: 'resetStats' }, (res) => {
        if (res && res.success) {
          alert('Ad counters have been reset.');
        }
      });
    }
  });
});

