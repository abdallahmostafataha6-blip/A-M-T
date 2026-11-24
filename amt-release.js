/*
  A-M-T site: release data, read live from GitHub Releases. Nothing to edit on the site for a new version:
  publish a GitHub Release with the A-M-T-Setup-<version>.exe and its notes, and every page follows.

  Add to a page:  <script src="/amt-release.js" defer></script>
  Then mark elements:
    data-amt="version"          1.9.1
    data-amt="version-text"     Version 1.9.1 / الإصدار 1.9.1
    data-amt="release-title"    the release title
    data-amt="release-date"     publish date (in the page language)
    data-amt="release-size"     installer size
    data-amt="sha256"           installer SHA-256
    data-amt="downloads"        downloads of the latest installer
    data-amt="downloads-total"  downloads of all A-M-T installers (all releases)
    data-amt="notes"            release notes of the latest version (page language)
    data-amt="changelog"        every release, newest first (page language)
    data-amt="download"         <a>: link to the latest installer
    data-amt="release-url"      <a>: link to the latest release page

  Release notes: English first, then a line with only "---", then Arabic. Arabic pages (<html lang="ar">) show the
  Arabic part, English pages the English part.
  If GitHub cannot be reached (offline / rate limit), /version.json is used; it is updated by a GitHub Action
  (.github/workflows/version-json.yml) every time a release is published.
  Results are cached for 30 minutes (GitHub allows 60 anonymous requests per hour).
*/
(function () {
  'use strict';

  var REPO = 'abdallahmostafataha6-blip/A-M-T';
  var API = 'https://api.github.com/repos/' + REPO + '/releases';
  var RELEASES = 'https://github.com/' + REPO + '/releases';
  var CACHE_KEY = 'amt-github-releases-v2';
  var TTL = 30 * 60 * 1000;

  function isAr() { return (document.documentElement.lang || '').toLowerCase().indexOf('ar') === 0; }
  function t(en, ar) { return isAr() ? ar : en; }

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

  /* The language part of the notes: English before a line "---", Arabic after it. */
  function notesFor(body) {
    var text = String(body || '').replace(/\r/g, '');
    var parts = text.split(/\n-{3,}\s*\n/);
    if (parts.length < 2) return text;
    return (isAr() ? parts[1] : parts[0]).trim();
  }

  /* Small, safe Markdown subset. Everything is escaped first; raw HTML is never executed. */
  function markdown(source) {
    var lines = escapeHtml(source || '').split('\n');
    var html = [], list = false;
    function inline(s) {
      return s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
        var url = safeUrl(href.replace(/&amp;/g, '&'));
        return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
      }).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var item = line.match(/^[-*]\s+(.*)$/);
      if (item) { if (!list) { html.push('<ul>'); list = true; } html.push('<li>' + inline(item[1]) + '</li>'); continue; }
      if (list) { html.push('</ul>'); list = false; }
      if (!line) continue;
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { var level = Math.min(4, h[1].length + 1); html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>'); continue; }
      html.push('<p>' + inline(line) + '</p>');
    }
    if (list) html.push('</ul>');
    return html.join('');
  }

  function versionFromTag(tag) {
    var match = String(tag || '').match(/(\d+(?:\.\d+){1,3})/);
    return match ? match[1] : '';
  }

  function dateText(iso) {
    if (!iso) return '';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso).slice(0, 10);
    try { return date.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { return String(iso).slice(0, 10); }
  }

  function sizeText(bytes) {
    if (!bytes || !Number(bytes)) return '';
    var mb = (Number(bytes) / 1048576).toFixed(1);
    return t(mb + ' MB', mb + ' ميجابايت');
  }

  function numberText(n) {
    try { return Number(n || 0).toLocaleString(isAr() ? 'ar-EG' : 'en-US'); } catch (e) { return String(n || 0); }
  }

  function installer(release) {
    var assets = (release && release.assets) || [], best = null;
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (a.state && a.state !== 'uploaded') continue;
      if (!/\.exe$/i.test(a.name || '')) continue;
      if (!best || /^A-M-T-Setup/i.test(a.name)) best = a;
    }
    return best;
  }

  function fromRelease(release) {
    var exe = installer(release);
    var digest = exe && exe.digest ? String(exe.digest).replace(/^sha256:/i, '') : '';
    return {
      version: versionFromTag(release.tag_name),
      title: release.name || ('A-M-T ' + versionFromTag(release.tag_name)),
      body: release.body || '',
      date: release.published_at || '',
      url: release.html_url || RELEASES,
      download: exe ? exe.browser_download_url : null,
      size: exe ? exe.size : 0,
      count: exe ? (exe.download_count || 0) : 0,
      sha256: /^[0-9a-f]{64}$/i.test(digest) ? digest : ''
    };
  }

  var data = null;   // { latest: {...}, all: [...], total: n }

  function each(name, fn) {
    var nodes = document.querySelectorAll('[data-amt="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function apply() {
    if (!data || !data.latest) return;
    var r = data.latest, v = r.version;
    each('version', function (n) { n.textContent = v; });
    each('version-text', function (n) { n.textContent = t('Version ', 'الإصدار ') + v; });
    each('footer-version', function (n) { n.textContent = t('Version ', 'الإصدار ') + v; });
    each('release-title', function (n) { n.textContent = r.title; });
    each('release-date', function (n) { n.textContent = dateText(r.date); });
    each('release-size', function (n) { n.textContent = sizeText(r.size); });
    each('sha256', function (n) { n.textContent = r.sha256 || t('shown on the GitHub release page', 'موجود في صفحة الإصدار على GitHub'); });
    if (data.counts) {
      each('downloads', function (n) { n.textContent = numberText(r.count); });
      each('downloads-total', function (n) { n.textContent = numberText(data.total); });
    }
    each('notes', function (n) {
      n.classList.add('amt-release-notes');
      var notes = notesFor(r.body);
      n.innerHTML = notes ? markdown(notes) : '<p>' + t('No release notes for this version.', 'لا توجد ملاحظات لهذا الإصدار.') + '</p>';
    });
    each('download', function (n) { var u = safeUrl(r.download || r.url || RELEASES); if (u) n.setAttribute('href', u); });
    each('release-url', function (n) { var u = safeUrl(r.url || RELEASES); if (u) n.setAttribute('href', u); });
    each('changelog', function (n) {
      if (!data.all || !data.all.length) return;
      var html = [];
      for (var i = 0; i < data.all.length; i++) {
        var x = data.all[i];
        var dl = safeUrl(x.download || x.url);
        html.push('<article class="amt-changelog-item"><header><h2>' + escapeHtml(x.title) + '</h2>' +
          (i === 0 ? '<span class="amt-badge">' + t('Latest', 'الأحدث') + '</span>' : '') +
          '<span class="meta">' + escapeHtml(dateText(x.date)) + (x.size ? ' · ' + escapeHtml(sizeText(x.size)) : '') +
          (data.counts && x.download ? ' · ' + escapeHtml(numberText(x.count)) + ' ' + t('downloads', 'تحميل') : '') + '</span>' +
          (dl ? '<a class="meta" href="' + escapeHtml(dl) + '">' + t('Download', 'تحميل') + '</a>' : '') +
          '</header><div class="amt-release-notes">' + (notesFor(x.body) ? markdown(notesFor(x.body)) : '') + '</div></article>');
      }
      n.innerHTML = html.join('');
    });
    var meta = document.querySelectorAll('script[type="application/ld+json"]');
    for (var k = 0; k < meta.length; k++) {
      var json = meta[k].textContent || '';
      if (/"softwareVersion"\s*:/.test(json)) meta[k].textContent = json.replace(/"softwareVersion"\s*:\s*"[^"]*"/, '"softwareVersion": "' + v + '"');
    }
  }

  function readCache() {
    try {
      var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !cached.data) return false;
      data = cached.data;
      apply();
      return (Date.now() - (cached.at || 0)) < TTL;
    } catch (e) { return false; }
  }

  function saveCache() {
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { }
  }

  function fromGitHub() {
    return window.fetch(API + '?per_page=30', { headers: { 'Accept': 'application/vnd.github+json' }, cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub HTTP ' + response.status);
        return response.json();
      }).then(function (list) {
        var all = [], total = 0;
        for (var i = 0; i < list.length; i++) {
          if (list[i].draft || list[i].prerelease) continue;
          var r = fromRelease(list[i]);
          if (!r.version) continue;
          total += r.count;
          all.push(r);
        }
        if (!all.length) throw new Error('no release');
        data = { latest: all[0], all: all, total: total, counts: true };
        saveCache();
        apply();
      });
  }

  /* Backup: the site's own version.json (kept up to date by the GitHub Action). */
  function fromVersionJson() {
    return window.fetch('/version.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (j) {
      var en = (j.notes || []).map(function (s) { return '- ' + s; }).join('\n');
      var ar = (j.notes_ar || []).map(function (s) { return '- ' + s; }).join('\n');
      var latest = { version: j.version, title: 'A-M-T ' + j.version, body: en + (ar ? '\n\n---\n\n' + ar : ''), date: j.released,
                     url: j.release_url || RELEASES, download: j.installer, size: j.size, count: 0, sha256: j.sha256 || '' };
      if (!data) { data = { latest: latest, all: [latest], total: 0, counts: false }; apply(); }
    });
  }

  function init() {
    var fresh = readCache();
    if (fresh || !window.fetch) return;
    fromGitHub().catch(function () { return fromVersionJson(); }).catch(function () { /* the text in the HTML stays */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
