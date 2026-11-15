/**
 * CleanTube - Content Script
 * Runs in YouTube tabs (Isolated World).
 * Auto-skips ads, manages DOM mutations, removes empty wrappers, and reports stats.
 */

(function () {
  'use strict';

  let isEnabled = true;
  let settings = {
    isEnabled: true,
    blockOverlays: true,
    blockCompanion: true,
    blockInFeed: true,
    autoSkip: true,
    blockAnnotations: true,
    speedMultiplier: 16
  };
  let whitelist = [];
  let currentChannel = null;
  let observer = null;
  let adHandlingDebounce = false;

  // 1. Main World injection is handled cleanly via chrome.scripting.executeScript (world: 'MAIN') in background.js
  // (No manual <script src="chrome-extension://..."> tags needed, avoiding cross-origin frame warnings)

  // 2. Extract current channel name/handle if available
  function extractChannel() {
    const channelAnchor = document.querySelector(
      'ytd-watch-metadata #channel-name a, ytd-video-owner-renderer #channel-name a, #owner #channel-name a'
    );
    if (channelAnchor && channelAnchor.href) {
      const match = channelAnchor.href.match(/@([^/?#]+)/) || channelAnchor.href.match(/\/channel\/([^/?#]+)/);
      if (match) {
        currentChannel = match[0].startsWith('@') ? match[0] : `@${match[1]}`;
        return currentChannel;
      }
    }
    return null;
  }

  function isCurrentChannelWhitelisted() {
    if (!currentChannel) extractChannel();
    if (!currentChannel) return false;
    return whitelist.includes(currentChannel);
  }

  // 3. Purge empty ad wrappers to guarantee NO black boxes in feeds
  function purgeEmptyAdWrappers() {
    if (!isEnabled || isCurrentChannelWhitelisted()) return;

    // Rich grid media item placeholders
    const adWrappers = document.querySelectorAll(
      'ytd-rich-item-renderer:has(ytd-ad-slot-renderer), ' +
      'ytd-rich-item-renderer:has(ytd-display-ad-renderer), ' +
      'ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer), ' +
      'ytd-rich-item-renderer:has(ytd-rich-grid-media-ad-renderer)'
    );

    for (let i = 0; i < adWrappers.length; i++) {
      const el = adWrappers[i];
      if (el.style.display !== 'none') {
        el.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // 4. Instant Fast-forward and auto-skip active video ads
  function handleVideoAds() {
    if (!isEnabled || isCurrentChannelWhitelisted()) return;

    purgeEmptyAdWrappers();

    const moviePlayer = document.querySelector('#movie_player, .html5-video-player');
    const isAdShowing = moviePlayer && (
      moviePlayer.classList.contains('ad-showing') ||
      moviePlayer.classList.contains('ad-interrupting')
    );

    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

    if (isAdShowing && video) {
      // Instantly mute ad
      video.muted = true;

      // Jump video timeline to end of ad segment immediately
      if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
        if (video.currentTime < video.duration) {
          video.currentTime = video.duration - 0.05;
        }
      }

      // Maximize playback rate
      if (video.playbackRate < (settings.speedMultiplier || 16)) {
        video.playbackRate = settings.speedMultiplier || 16;
      }

      // Report ad blocked to background worker (debounced)
      if (!adHandlingDebounce) {
        adHandlingDebounce = true;
        chrome.runtime.sendMessage({ action: 'adBlocked', count: 1, timeSavedSeconds: 15 });
        setTimeout(() => { adHandlingDebounce = false; }, 2000);
      }
    }

    // Auto-click all modern YouTube skip button variants
    if (settings.autoSkip) {
      const skipButtons = document.querySelectorAll(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-text, ' +
        'button[aria-label*="Skip"], .ytp-ad-player-overlay-layout__skip-or-preview-container button'
      );
      for (let i = 0; i < skipButtons.length; i++) {
        const btn = skipButtons[i];
        if (btn && typeof btn.click === 'function') {
          btn.click();
        }
      }
    }

    // Dismiss any modal anti-adblock popups
    handleAntiAdblockPopup();
  }

  // 5. Handle YouTube's anti-adblock popup dialog
  function handleAntiAdblockPopup() {
    const dialog = document.querySelector('tp-yt-paper-dialog:has(yt-playability-error-supported-renderers), ytd-enforcement-message-view-model');
    if (dialog) {
      dialog.remove();
      document.body.classList.add('cleantube-unlocked');

      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    }
  }

  // 6. Update annotations visibility class
  function applyAnnotationSetting() {
    if (settings.blockAnnotations && isEnabled && !isCurrentChannelWhitelisted()) {
      document.body.classList.add('cleantube-no-annotations');
    } else {
      document.body.classList.remove('cleantube-no-annotations');
    }
  }

  // 7. Setup DOM MutationObserver
  function setupObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      handleVideoAds();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // 7. Initialize and fetch background settings
  async function init() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getGlobalState' });
      if (response && response.data) {
        isEnabled = response.data.isEnabled !== false;
        settings = { ...settings, ...(response.data.settings || {}) };
        whitelist = response.data.whitelist || [];
      }
    } catch (e) {}

    applyAnnotationSetting();
    setupObserver();
    handleVideoAds();
    extractChannel();

    // Hook YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', () => {
      extractChannel();
      applyAnnotationSetting();
      handleVideoAds();
    });

    // High frequency interval (100ms) to ensure ZERO delay if an ad tries to render
    setInterval(handleVideoAds, 100);
  }

  // 9. Listen to background broadcast messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'stateChanged':
        isEnabled = message.isEnabled;
        applyAnnotationSetting();
        handleVideoAds();
        sendResponse({ success: true });
        break;

      case 'settingsUpdated':
        settings = { ...settings, ...(message.settings || {}) };
        applyAnnotationSetting();
        handleVideoAds();
        sendResponse({ success: true });
        break;

      case 'whitelistUpdated':
        whitelist = message.whitelist || [];
        applyAnnotationSetting();
        handleVideoAds();
        sendResponse({ success: true });
        break;

      case 'getCurrentChannel':
        extractChannel();
        sendResponse({
          channel: currentChannel,
          isWhitelisted: isCurrentChannelWhitelisted()
        });
        break;
    }
  });

  // Run on start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
