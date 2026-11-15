/**
 * CleanTube - Service Worker (Background Script)
 * Controls declarativeNetRequest, webNavigation MAIN world injection, and storage state.
 */

const DEFAULT_SETTINGS = {
  isEnabled: true,
  blockOverlays: true,
  blockCompanion: true,
  blockInFeed: true,
  autoSkip: true,
  blockAnnotations: true,
  speedMultiplier: 16
};

const DEFAULT_STATS = {
  blockedToday: 0,
  blockedTotal: 0,
  timeSaved: 0,
  lastResetDate: new Date().toISOString().slice(0, 10)
};

// Initialize extension defaults on install
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(['isEnabled', 'settings', 'stats', 'whitelist']);
  
  const updates = {};
  if (existing.isEnabled === undefined) updates.isEnabled = true;
  if (!existing.settings) updates.settings = { ...DEFAULT_SETTINGS };
  if (!existing.stats) updates.stats = { ...DEFAULT_STATS };
  if (!existing.whitelist) updates.whitelist = [];

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  chrome.alarms.create('dailyStatsReset', { periodInMinutes: 60 });
  updateBadge(existing.isEnabled !== false ? (existing.stats?.blockedToday || 0) : null);
});

// Alarm listener for daily stats reset
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyStatsReset') {
    const data = await chrome.storage.local.get(['stats']);
    if (data.stats) {
      const today = new Date().toISOString().slice(0, 10);
      if (data.stats.lastResetDate !== today) {
        data.stats.blockedToday = 0;
        data.stats.lastResetDate = today;
        await chrome.storage.local.set({ stats: data.stats });
        updateBadge(0);
      }
    }
  }
});

// Update extension icon badge
function updateBadge(count) {
  if (count === null || count === undefined) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#EA4335' });
    return;
  }
  
  if (count === 0) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    const text = count > 999 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  }
}

// Enable or disable declarativeNetRequest static rulesets
async function toggleDNRRules(enable) {
  if (enable) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['ruleset_ads', 'ruleset_tracking']
    });
  } else {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['ruleset_ads', 'ruleset_tracking']
    });
  }
}

// Guarantee MAIN world script execution on navigation commit
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (!details.url || !details.url.includes('youtube.com')) return;

  const data = await chrome.storage.local.get(['isEnabled']);
  if (data.isEnabled === false) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      files: ['injected.js'],
      world: 'MAIN',
      injectImmediately: true
    });
  } catch (err) {
    // Tab or frame might have closed or not be scriptable
  }
});

// Handle messages from content scripts, popup, or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'getGlobalState': {
        const data = await chrome.storage.local.get(['isEnabled', 'settings', 'stats', 'whitelist']);
        sendResponse({ success: true, data });
        break;
      }

      case 'toggleGlobal': {
        const isEnabled = message.isEnabled;
        await chrome.storage.local.set({ isEnabled });
        await toggleDNRRules(isEnabled);

        const data = await chrome.storage.local.get(['stats']);
        updateBadge(isEnabled ? (data.stats?.blockedToday || 0) : null);

        const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action: 'stateChanged', isEnabled }).catch(() => {});
        }
        sendResponse({ success: true, isEnabled });
        break;
      }

      case 'adBlocked': {
        const adCount = message.count || 1;
        const timeSavedSeconds = message.timeSavedSeconds || 15;

        const data = await chrome.storage.local.get(['stats', 'isEnabled']);
        if (data.isEnabled === false) {
          sendResponse({ success: false, reason: 'disabled' });
          return;
        }

        const stats = data.stats || { ...DEFAULT_STATS };
        const today = new Date().toISOString().slice(0, 10);
        if (stats.lastResetDate !== today) {
          stats.blockedToday = 0;
          stats.lastResetDate = today;
        }

        stats.blockedToday += adCount;
        stats.blockedTotal += adCount;
        stats.timeSaved += timeSavedSeconds;

        await chrome.storage.local.set({ stats });
        updateBadge(stats.blockedToday);
        sendResponse({ success: true, stats });
        break;
      }

      case 'updateSettings': {
        const settings = message.settings;
        await chrome.storage.local.set({ settings });
        
        const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case 'updateWhitelist': {
        const whitelist = message.whitelist || [];
        await chrome.storage.local.set({ whitelist });
        
        const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action: 'whitelistUpdated', whitelist }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case 'resetStats': {
        const today = new Date().toISOString().slice(0, 10);
        const stats = { blockedToday: 0, blockedTotal: 0, timeSaved: 0, lastResetDate: today };
        await chrome.storage.local.set({ stats });
        updateBadge(0);
        sendResponse({ success: true, stats });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true;
});

// Keyboard shortcut listener (Alt+Shift+B)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-blocking') {
    const data = await chrome.storage.local.get(['isEnabled', 'stats']);
    const newState = !(data.isEnabled !== false);
    await chrome.storage.local.set({ isEnabled: newState });
    await toggleDNRRules(newState);
    updateBadge(newState ? (data.stats?.blockedToday || 0) : null);

    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'stateChanged', isEnabled: newState }).catch(() => {});
    }
  }
});
