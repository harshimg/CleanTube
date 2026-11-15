/**
 * CleanTube - Popup Script
 * Reads storage, manages toggles, queries current tab channel info, and sends messages to background.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const globalToggle = document.getElementById('global-toggle');
  const statusText = document.getElementById('status-text');
  const blockedTodayEl = document.getElementById('blocked-today');
  const blockedTotalEl = document.getElementById('blocked-total');
  const timeSavedEl = document.getElementById('time-saved');
  const channelNameEl = document.getElementById('channel-name');
  const whitelistBtn = document.getElementById('whitelist-btn');

  let currentChannel = null;
  let activeTabId = null;

  // Format seconds into minutes/hours
  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  }

  // Update popup state from storage data
  function updateUI(data) {
    const isEnabled = data.isEnabled !== false;
    globalToggle.checked = isEnabled;
    statusText.textContent = isEnabled ? 'Active & Protecting' : 'Paused';
    if (isEnabled) {
      statusText.classList.remove('paused');
    } else {
      statusText.classList.add('paused');
    }

    const stats = data.stats || { blockedToday: 0, blockedTotal: 0, timeSaved: 0 };
    blockedTodayEl.textContent = stats.blockedToday.toLocaleString();
    blockedTotalEl.textContent = stats.blockedTotal.toLocaleString();
    timeSavedEl.textContent = formatTime(stats.timeSaved);

    // Whitelist status
    const whitelist = data.whitelist || [];
    if (currentChannel) {
      const isWhitelisted = whitelist.includes(currentChannel);
      whitelistBtn.disabled = false;
      if (isWhitelisted) {
        whitelistBtn.textContent = 'Whitelisted';
        whitelistBtn.classList.add('whitelisted');
      } else {
        whitelistBtn.textContent = 'Whitelist';
        whitelistBtn.classList.remove('whitelisted');
      }
    }
  }

  // 1. Fetch initial state
  const data = await chrome.storage.local.get(['isEnabled', 'stats', 'whitelist']);
  updateUI(data);

  // 2. Query active tab for channel info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && (tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/@') || tab.url.includes('youtube.com/channel/'))) {
    activeTabId = tab.id;
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'getCurrentChannel' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Tab may not have finished loading content script
          channelNameEl.textContent = 'YouTube';
          whitelistBtn.disabled = true;
          return;
        }

        if (response.channel) {
          currentChannel = response.channel;
          channelNameEl.textContent = currentChannel;
          whitelistBtn.disabled = false;
          if (response.isWhitelisted) {
            whitelistBtn.textContent = 'Whitelisted';
            whitelistBtn.classList.add('whitelisted');
          } else {
            whitelistBtn.textContent = 'Whitelist';
            whitelistBtn.classList.remove('whitelisted');
          }
        } else {
          channelNameEl.textContent = 'YouTube Home/Feed';
          whitelistBtn.disabled = true;
        }
      });
    } catch (e) {
      channelNameEl.textContent = 'YouTube';
      whitelistBtn.disabled = true;
    }
  } else {
    channelNameEl.textContent = 'Not on YouTube';
    whitelistBtn.disabled = true;
  }

  // 3. Handle global toggle change
  globalToggle.addEventListener('change', () => {
    const isEnabled = globalToggle.checked;
    globalToggle.setAttribute('aria-checked', isEnabled.toString());
    statusText.textContent = isEnabled ? 'Active & Protecting' : 'Paused';
    if (isEnabled) {
      statusText.classList.remove('paused');
    } else {
      statusText.classList.add('paused');
    }

    chrome.runtime.sendMessage({
      action: 'toggleGlobal',
      isEnabled,
      reloadTabId: activeTabId
    });
  });

  // 4. Handle whitelist toggle button
  whitelistBtn.addEventListener('click', async () => {
    if (!currentChannel) return;

    const data = await chrome.storage.local.get(['whitelist']);
    let whitelist = data.whitelist || [];
    const index = whitelist.indexOf(currentChannel);

    if (index > -1) {
      // Remove from whitelist
      whitelist.splice(index, 1);
      whitelistBtn.textContent = 'Whitelist';
      whitelistBtn.classList.remove('whitelisted');
    } else {
      // Add to whitelist
      whitelist.push(currentChannel);
      whitelistBtn.textContent = 'Whitelisted';
      whitelistBtn.classList.add('whitelisted');
    }

    chrome.runtime.sendMessage({
      action: 'updateWhitelist',
      whitelist,
      reloadTabId: activeTabId
    });
  });
});

