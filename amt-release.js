/*
  A-M-T site: live version / release data from the latest GitHub Release.
  No build step. Add to every page with:  <script src="amt-release.js" defer></script>

  Fields used:
    tag_name       -> version number (the leading v/V and a leading dot are removed)
    name           -> release title ("What's new" heading on download.html)
    body           -> release notes (converted from Markdown safely)
    published_at   -> release date
    assets[].exe   -> download link, size and SHA-256 (from digest, when present)

  The numbers written in the HTML stay as a fallback (offline / JS disabled / GitHub down).
  The result is cached in localStorage for 30 minutes to stay inside GitHub's rate limit.
*/
(function () {
  'use strict';

  var API = 'https://api.github.com/repos/abdallahmostafataha6-blip/A-M-T/releases/latest';
  var RELEASES = 'https://github.com/abdallahmostafataha6-blip/A-M-T/releases';
  var CACHE_KEY = 'amt-github-release-v1';
  var TTL = 30 * 60 * 1000;
  var FALLBACK_VERSION = '1.8.14';
  var state = null;

  function isAr() { return document.documentElement.lang === 'ar'; }
  function lang() { return isAr() ? 'ar' : 'en'; }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    try {
      var url = new URL(String(value || ''), window.location.href);
      return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
    } catch (e) { return null; }
  }

  /* Small, safe Markdown subset. Everything is escaped first; raw HTML is never executed. */
  function markdown(source) {
    var text = escapeHtml(source || '');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
      var url = safeUrl(href.replace(/&amp;/g, '&'));
      return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
               .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
               .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    text = text.replace(/(?:^|\n)[-*]\s+([^\n]*)/g, '\n<li>$1</li>');
    text = text.replace(/(?:<li>[^\n]*<\/li>\s*)+/g, function (list) {
      return '<ul>' + list.replace(/\s*\n\s*/g, '') + '</ul>';
    });
    text = text.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<p>' + text + '</p>';
  }

  function versionFromTag(tag) {
    var match = String(tag || '').match(/(\d+(?:\.\d+){1,3})/);
    return match ? match[1] : '';
  }

  function versionSentence(version) {
    return isAr() ? 'الإصدار ' + version : 'Version ' + version;
  }

  function dateText(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso).slice(0, 10);
    try { return date.toLocaleDateString(lang() === 'ar' ? 'ar-EG' : 'en-GB'); }
    catch (e) { return String(iso).slice(0, 10); }
  }

  function sizeText(bytes) {
    if (!bytes || !Number(bytes)) return '';
    var mb = (Number(bytes) / 1048576).toFixed(1);
    return lang() === 'ar' ? mb + ' ميجابايت' : mb + ' MB';
  }

  function setText(attribute, value) {
    var nodes = document.querySelectorAll('[data-amt="' + attribute + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  function setHref(attribute, value) {
    var safe = safeUrl(value);
    if (!safe) return;
    var nodes = document.querySelectorAll('[data-amt="' + attribute + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute('href', safe);
  }

  function apply() {
    if (!state) return;
    var version = state.version || FALLBACK_VERSION;
    var notes = state.notes ? markdown(state.notes)
      : (isAr() ? '<p>لا توجد ملاحظات لهذا الإصدار.</p>' : '<p>No release notes for this version.</p>');

    setText('version', version);
    setText('version-text', versionSentence(version));
    setText('footer-version', versionSentence(version));
    setText('release-title', state.title || (isAr() ? 'A-M-T ' + version : 'A-M-T ' + version));
    setText('release-date', dateText(state.date));
    setText('release-size', sizeText(state.size));

    var notesNodes = document.querySelectorAll('[data-amt="notes"]');
    for (var i = 0; i < notesNodes.length; i++) notesNodes[i].innerHTML = notes;

    setHref('download', state.download || state.url || RELEASES);
    setHref('release-url', state.url || RELEASES);

    document.title = document.title.replace(/1\.8\.\d+/, version);
    var meta = document.querySelectorAll('meta[name="description"]');
    for (var j = 0; j < meta.length; j++) {
      var content = meta[j].getAttribute('content') || '';
      if (/1\.8\.\d+/.test(content)) meta[j].setAttribute('content', content.replace(/1\.8\.\d+/, version));
    }
    var structured = document.querySelectorAll('script[type="application/ld+json"]');
    for (var k = 0; k < structured.length; k++) {
      var json = structured[k].textContent || '';
      if (/"softwareVersion"\s*:\s*"[^"]*"/.test(json)) {
        structured[k].textContent = json.replace(/"softwareVersion"\s*:\s*"[^"]*"/, '"softwareVersion": "' + version + '"');
      }
    }
  }

  function readCache() {
    try {
      var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.data) return false;
      state = cached.data;                 // show cached data at once, even if stale
      apply();
      return (Date.now() - (cached.at || 0)) < TTL;
    } catch (e) { return false; }
  }

  function saveCache(data) {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); }
    catch (e) { /* private mode / full storage: ignore */ }
  }

  function fetchRelease() {
    if (!window.fetch) return;                 // very old browser: keep the HTML fallback
    window.fetch(API, {
      headers: { 'Accept': 'application/vnd.github+json' },
      cache: 'no-store'
    }).then(function (response) {
      if (!response.ok) throw new Error('GitHub HTTP ' + response.status);
      return response.json();
    }).then(function (release) {
      if (!release || release.draft || release.prerelease) throw new Error('no stable release');
      var exe = null;
      var assets = release.assets || [];
      for (var i = 0; i < assets.length; i++) {
        if (assets[i].state === 'uploaded' && /\.exe$/i.test(assets[i].name || '')) { exe = assets[i]; break; }
      }
      var digest = exe && exe.digest ? String(exe.digest).replace(/^sha256:/i, '') : '';
      state = {
        version: versionFromTag(release.tag_name) || FALLBACK_VERSION,
        tag: release.tag_name || '',
        title: release.name || 'A-M-T ' + versionFromTag(release.tag_name),
        notes: release.body || '',
        date: release.published_at || '',
        url: release.html_url || RELEASES,
        download: exe ? exe.browser_download_url : null,
        size: exe ? exe.size : 0,
        sha256: /^[0-9a-f]{64}$/i.test(digest) ? digest : ''
      };
      saveCache(state);
      apply();
    }).catch(function () {
      /* GitHub down, rate-limited or offline: the cached / hardcoded values stay visible. */
    });
  }

  function init() {
    var fresh = readCache();
    apply();
    if (!fresh) fetchRelease();
  }

  /* Re-write the generated sentences when the visitor switches EN / عربي. */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.closest && target.closest('[data-lang]')) window.setTimeout(apply, 0);
  }, true);
  window.addEventListener('storage', function (event) {
    if (event.key === 'amt-site-language') window.setTimeout(apply, 0);
  });
  if (window.MutationObserver) {
    new MutationObserver(function () { apply(); }).observe(document.documentElement, {
      attributes: true, attributeFilter: ['lang', 'dir']
    });
  }

  /* Deferred scripts run before DOMContentLoaded, so wait for the page's own language script. */
  if (document.readyState === 'complete') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
