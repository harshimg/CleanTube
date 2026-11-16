/**
 * CleanTube Automated Unit & Static Integrity Test Suite
 * Validates manifest configuration, DNR rules validity, background service worker, and DOM logic.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n🧪 Running CleanTube Test Suite...\n');

// 1. Manifest V3 Integrity
console.log('--- Manifest V3 Specifications ---');
const manifestPath = path.join(ROOT_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

it('manifest exists and has manifest_version 3', () => {
  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.name, 'CleanTube — Ad Blocker for YouTube™');
  assert.strictEqual(manifest.version, '1.0.1');
});

it('requests only minimal scoped permissions (no <all_urls>)', () => {
  assert.ok(manifest.permissions.includes('declarativeNetRequest'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(!manifest.permissions.includes('<all_urls>'));
  assert.ok(manifest.host_permissions.every(p => p.includes('youtube.com') || p.includes('youtube-nocookie.com')));
});

it('defines valid icon paths that exist on disk', () => {
  Object.values(manifest.icons).forEach(iconRel => {
    const iconAbs = path.join(ROOT_DIR, iconRel);
    assert.ok(fs.existsSync(iconAbs), `Icon file ${iconRel} should exist`);
    const stats = fs.statSync(iconAbs);
    assert.ok(stats.size > 100, `Icon file ${iconRel} should have valid size`);
  });
});

it('declares ruleset resources pointing to valid files', () => {
  const rules = manifest.declarative_net_request.rule_resources;
  assert.ok(Array.isArray(rules) && rules.length >= 2);
  rules.forEach(rule => {
    const rulePath = path.join(ROOT_DIR, rule.path);
    assert.ok(fs.existsSync(rulePath), `Rule file ${rule.path} must exist`);
    const parsed = JSON.parse(fs.readFileSync(rulePath, 'utf8'));
    assert.ok(Array.isArray(parsed), `Rule file ${rule.path} must contain an array`);
  });
});

// 2. DNR Ruleset Quality Check
console.log('\n--- declarativeNetRequest Rulesets ---');
const adsRules = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rules.json'), 'utf8'));
const trackingRules = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'rules-tracking.json'), 'utf8'));

it('rules.json contains valid blocking rules for critical ad domains', () => {
  assert.ok(adsRules.length >= 7);
  const doubleclick = adsRules.find(r => r.condition.urlFilter && r.condition.urlFilter.includes('doubleclick.net'));
  assert.ok(doubleclick, 'doubleclick.net rule must be present');
  assert.strictEqual(doubleclick.action.type, 'block');
});

it('rules-tracking.json blocks YouTube telemetry and ptracking', () => {
  assert.ok(trackingRules.length >= 2);
  const telemetry = trackingRules.find(r => r.condition.regexFilter && r.condition.regexFilter.includes('stats/ads'));
  assert.ok(telemetry, 'stats/ads telemetry rule must be present');
});

// 3. Script & Style Assets Check
console.log('\n--- Script & Cosmetic Filter Assets ---');

it('cosmetic.css exists and targets YouTube ad selectors', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'cosmetic.css'), 'utf8');
  assert.ok(css.includes('ytd-companion-slot-renderer'));
  assert.ok(css.includes('ytd-masthead-ad-renderer'));
  assert.ok(css.includes('.ytp-ad-overlay-container'));
  assert.ok(css.includes('display: none !important'));
});

it('injected.js implements player property sanitization and fetch interceptor', () => {
  const js = fs.readFileSync(path.join(ROOT_DIR, 'injected.js'), 'utf8');
  assert.ok(js.includes('ytInitialPlayerResponse'));
  assert.ok(js.includes('adPlacements'));
  assert.ok(js.includes('playerAds'));
  assert.ok(js.includes('adSlots'));
});

it('content.js handles fast-forwarding, auto-skip clicks, and SPA navigation', () => {
  const js = fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8');
  assert.ok(js.includes('playbackRate'));
  assert.ok(js.includes('autoSkip'));
  assert.ok(js.includes('.ytp-ad-skip-button'));
  assert.ok(js.includes('yt-navigate-finish'));
  assert.ok(js.includes('MutationObserver'));
});

it('background.js implements alarms, badges, and toggle state persistence', () => {
  const js = fs.readFileSync(path.join(ROOT_DIR, 'background.js'), 'utf8');
  assert.ok(js.includes('chrome.alarms'));
  assert.ok(js.includes('updateBadge'));
  assert.ok(js.includes('chrome.declarativeNetRequest.updateEnabledRulesets'));
  assert.ok(js.includes('dailyStatsReset'));
});

// 4. UI Assets Check
console.log('\n--- UI Assets Check ---');

it('popup files exist with required controls', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'popup', 'popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT_DIR, 'popup', 'popup.js'), 'utf8');
  assert.ok(html.includes('id="global-toggle"'));
  assert.ok(html.includes('id="blocked-today"'));
  assert.ok(html.includes('id="whitelist-btn"'));
  assert.ok(js.includes('chrome.storage.local'));
});

it('options files exist with export/import and whitelist manager', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'options', 'options.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT_DIR, 'options', 'options.js'), 'utf8');
  assert.ok(html.includes('id="add-whitelist-btn"'));
  assert.ok(html.includes('id="export-btn"'));
  assert.ok(html.includes('id="import-file"'));
  assert.ok(js.includes('exportBtn'));
  assert.ok(js.includes('importFile'));
});

// Summary
console.log(`\n================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed`);
console.log(`================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

