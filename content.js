/**
 * CleanTube - Content Script
 * Runs in YouTube tabs (Isolated World).
 * Auto-skips ads, manages video player states, and reports stats.
 * Precision-scoped strictly to the video player to guarantee ZERO interference with search, navigation, or typing.
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

  // 1. Sync disabled class with root html element so CSS filters turn ON/OFF instantly
  function syncDisabledState() {
    const shouldDisable = !isEnabled || isCurrentChannelWhitelisted();
    if (shouldDisable) {
      document.documentElement.classList.add('cleantube-disabled');
    } else {
      document.documentElement.classList.remove('cleantube-disabled');
    }
  }

  // Early local storage sync
  try {
    chrome.storage.local.get(['isEnabled', 'whitelist'], (data) => {
      if (data) {
        if (data.isEnabled === false) isEnabled = false;
        if (Array.isArray(data.whitelist)) whitelist = data.whitelist;
        syncDisabledState();
      }
    });
  } catch (e) {}

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

  // 3. Fast-forward and auto-skip active video ads (strictly scoped to video player)
  function handleVideoAds() {
    if (!isEnabled || isCurrentChannelWhitelisted()) {
      syncDisabledState();
      return;
    }

    // Only run when a video player is actually present on page
    const moviePlayer = document.querySelector('#movie_player, .html5-video-player');
    if (!moviePlayer) return;

    // Check if an ad is actively playing or interrupting
    const isAdShowing = moviePlayer.classList.contains('ad-showing') ||
                        moviePlayer.classList.contains('ad-interrupting');

    // If NO ad is actively showing, DO NOT TOUCH ANYTHING (prevents interfering with search/UI)
    if (!isAdShowing) return;

    const video = moviePlayer.querySelector('video.html5-main-video') || moviePlayer.querySelector('video');

    if (video) {
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

    // Auto-click modern YouTube skip buttons STRICTLY inside the video player
    if (settings.autoSkip) {
      const skipButtons = moviePlayer.querySelectorAll(
        '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-text, ' +
        '.ytp-ad-player-overlay-layout__skip-or-preview-container button'
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

  // 4. Handle YouTube's anti-adblock popup dialog
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

  // 5. Update annotations visibility class
  function applyAnnotationSetting() {
    if (settings.blockAnnotations && isEnabled && !isCurrentChannelWhitelisted()) {
      document.body.classList.add('cleantube-no-annotations');
    } else {
      document.body.classList.remove('cleantube-no-annotations');
    }
  }

  // 6. Setup DOM MutationObserver - target the player directly, never search or body inputs
  function setupObserver() {
    if (observer) observer.disconnect();

    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer) {
      // Focus strictly on player class changes (ad-showing / ad-interrupting)
      observer = new MutationObserver(() => {
        if (isEnabled && !isCurrentChannelWhitelisted()) {
          handleVideoAds();
        }
      });
      observer.observe(moviePlayer, {
        attributes: true,
        attributeFilter: ['class']
      });
    } else {
      // If player not rendered yet, wait for it via lightweight childList observer on #ytd-player or main container
      observer = new MutationObserver(() => {
        if (document.querySelector('#movie_player')) {
          setupObserver();
          handleVideoAds();
        }
      });
      const container = document.querySelector('ytd-page-manager') || document.body;
      if (container) {
        observer.observe(container, {
          childList: true,
          subtree: false // Shallow observation only, zero performance impact!
        });
      }
    }
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

    extractChannel();
    syncDisabledState();
    applyAnnotationSetting();
    setupObserver();
    if (isEnabled) handleVideoAds();

    // Hook YouTube SPA navigation events
    window.addEventListener('yt-navigate-finish', () => {
      extractChannel();
      syncDisabledState();
      applyAnnotationSetting();
      setupObserver();
      if (isEnabled) handleVideoAds();
    });

    // Gentle polling interval (250ms) - only checks when video player is present
    setInterval(() => {
      if (isEnabled && !isCurrentChannelWhitelisted()) {
        handleVideoAds();
      }
    }, 250);
  }

  // 8. Listen to background broadcast messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'stateChanged':
        isEnabled = message.isEnabled;
        syncDisabledState();
        applyAnnotationSetting();
        if (isEnabled) handleVideoAds();
        sendResponse({ success: true });
        break;

      case 'settingsUpdated':
        settings = { ...settings, ...(message.settings || {}) };
        syncDisabledState();
        applyAnnotationSetting();
        if (isEnabled) handleVideoAds();
        sendResponse({ success: true });
        break;

      case 'whitelistUpdated':
        whitelist = message.whitelist || [];
        extractChannel();
        syncDisabledState();
        applyAnnotationSetting();
        if (isEnabled) handleVideoAds();
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
