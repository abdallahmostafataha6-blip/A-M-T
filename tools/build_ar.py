#!/usr/bin/env python3
"""
Builds the Arabic site (/ar/...) from the English pages and i18n/ar.json, and writes sitemap.xml.

    python tools/build_ar.py            build /ar and sitemap.xml
    python tools/build_ar.py --check    also fail (exit 1) when a text has no translation

Every visible text, page title, description and image text of an English page is looked up in i18n/ar.json
("English text": "النص العربي"). Texts that are not in the file stay in English and are listed in
i18n/missing.txt, so a new English page or paragraph only needs its lines added to ar.json.
The GitHub Action .github/workflows/build-ar.yml runs this on every push to main.
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://a-m-t-tools.pages.dev'
os.chdir(ROOT)

DICT = json.load(open('i18n/ar.json', encoding='utf-8'))
TEXT = DICT.get('text', {})
JS = DICT.get('js', {})

PAGES = sorted(p for p in glob.glob('*.html') + glob.glob('guides/*.html') if not os.path.basename(p).startswith('google'))
PAGE_SET = set(PAGES)
missing = {}

TOKEN = re.compile(r'(<!--.*?-->|<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)', re.S | re.I)
ATTR = re.compile(r'\b(alt|title|aria-label|placeholder|content)=("([^"]*)"|\'([^\']*)\')', re.I)
TRANSLATED_META = ('description', 'og:title', 'og:description', 'twitter:title', 'twitter:description', 'og:image:alt')


def key_of(text):
    return ' '.join(html.unescape(text).split())


def lookup(text, page):
    key = key_of(text)
    if not key or not re.search('[A-Za-z]', key):
        return None
    if key in TEXT:
        return TEXT[key]
    missing.setdefault(key, set()).add(page)
    return None


def esc(text, quote=False):
    out = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return out.replace('"', '&quot;') if quote else out


def ar_href(url):
    """Internal page links go to the Arabic page; files (images, PDFs, videos) stay as they are."""
    if not url.startswith('/') or url.startswith('//') or url.startswith('/ar/'):
        return url
    path, sep, frag = url.partition('#')
    if path == '/':
        return '/ar/' + sep + frag
    if path.lstrip('/') in PAGE_SET:
        return '/ar' + path + sep + frag
    return url


def translate_tag(tag, page):
    low = tag.lower()
    if low.startswith('<html'):
        tag = re.sub(r'\blang="[^"]*"', 'lang="ar" dir="rtl"', tag)
        return tag if 'dir=' in tag else tag.replace('<html', '<html dir="rtl"', 1)
    is_meta = low.startswith('<meta')
    if is_meta:
        name = re.search(r'\b(?:name|property)="([^"]+)"', tag)
        name = name.group(1) if name else ''
        if name == 'og:locale':
            return re.sub(r'content="[^"]*"', 'content="ar_EG"', tag)
        if name == 'og:url':
            return re.sub(r'content="' + re.escape(SITE) + r'(/[^"]*)"', lambda m: 'content="' + SITE + ar_href(m.group(1)) + '"', tag)
        if name not in TRANSLATED_META:
            return tag

    def attr(m):
        name, value = m.group(1), m.group(3) if m.group(3) is not None else m.group(4)
        if name.lower() == 'content' and not is_meta:
            return m.group(0)
        if name.lower() == 'title' and low.startswith('<link'):
            return m.group(0)
        tr = lookup(value, page)
        return '%s="%s"' % (name, esc(tr, True)) if tr else m.group(0)
    tag = ATTR.sub(attr, tag)
    if low.startswith('<a') or low.startswith('<link rel="canonical"'):
        tag = re.sub(r'\bhref="([^"]*)"', lambda m: 'href="%s"' % (ar_href(m.group(1)) if low.startswith('<a') else m.group(1)), tag)
    return tag


def translate_script(block):
    for en, ar in JS.items():
        block = block.replace("'" + en + "'", "'" + ar + "'").replace('"' + en + '"', '"' + ar + '"').replace('`' + en + '`', '`' + ar + '`')
    return block


BLOCK = re.compile(r'<(p|li|h[1-6]|figcaption|td|th|summary|dt|dd|label|caption|button|title)\b([^>]*)>(.*?)</\1>', re.S | re.I)
NESTED = re.compile(r'<(p|li|ul|ol|div|h[1-6]|table|section|figure|article|header|footer|nav|main|script|style)\b', re.I)
INLINE = re.compile(r'<(?!br\b)[a-z]', re.I)


def norm_html(inner):
    return ' '.join(inner.split())


def translate_blocks(src, page, keep):
    """Paragraphs, list items, headings ... that hold inline markup (<b>, <a>, <code> ...) are translated as one
    piece, markup included, so the Arabic sentence keeps its natural order. Blocks of plain text are left to the
    text pass. Translated blocks are swapped for placeholders until the end (keep)."""
    def rep(m):
        tag, attrs, inner = m.group(1), m.group(2), m.group(3)
        if NESTED.search(inner) or not INLINE.search(inner):
            return m.group(0)
        key = norm_html(inner)
        if not re.search('[A-Za-z]', re.sub(r'<[^>]+>', '', key)):
            return m.group(0)
        if key in TEXT:
            value = TEXT[key]
            value = re.sub(r'href="(/[^"]*)"', lambda h: 'href="%s"' % ar_href(h.group(1)), value)
            keep.append('<%s%s>%s</%s>' % (tag, translate_tag('<x' + attrs + '>', page)[2:-1], value, tag))
            return '\x00%d\x00' % (len(keep) - 1)
        missing.setdefault(key, set()).add(page)
        return m.group(0)
    return BLOCK.sub(rep, src)


def build(page):
    src = open(page, encoding='utf-8').read()
    keep = []
    head_end = src.lower().find('<body')
    src = src[:head_end] + translate_blocks(src[head_end:], page, keep)
    parts = TOKEN.split(src)
    out = []
    in_title = False
    for part in parts:
        if not part:
            continue
        if part.startswith('<!--'):
            out.append(part)
        elif part[:7].lower() == '<script':
            out.append(translate_script(part) if 'application/ld+json' not in part[:60] else part)
        elif part[:6].lower() == '<style':
            out.append(part)
        elif part.startswith('<'):
            low = part.lower()
            if low.startswith('<title'):
                in_title = True
            elif low.startswith('</title'):
                in_title = False
            out.append(translate_tag(part, page))
        else:
            for piece in re.split('(\x00\\d+\x00)', part):   # text around block placeholders is translated on its own
                tr = None if piece.startswith('\x00') else lookup(piece, page)
                if tr:
                    lead = piece[:len(piece) - len(piece.lstrip())]
                    trail = piece[len(piece.rstrip()):]
                    out.append(lead + esc(tr) + trail)
                else:
                    out.append(piece)
    doc = ''.join(out)
    doc = re.sub('\x00(\\d+)\x00', lambda m: keep[int(m.group(1))], doc)
    path = '/' if page == 'index.html' else '/' + page
    ar = ar_href(path)
    doc = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s%s">' % (SITE, ar), doc)
    # language switch: Arabic is the active one here, and its EN link goes back to the English page
    doc = re.sub(r'<div class="language-switch".*?</div>',
                 '<div class="language-switch" role="group" aria-label="اللغة"><a href="%s" hreflang="en" lang="en">EN</a>'
                 '<span aria-hidden="true">|</span><a href="%s" hreflang="ar" class="active" aria-current="true">عربي</a></div>' % (path, ar),
                 doc, count=1, flags=re.S)
    target = os.path.join('ar', page)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    open(target, 'w', encoding='utf-8').write(doc)
    return path, ar


def main():
    urls = []
    for page in PAGES:
        urls.append(build(page))
    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n')
        for en, ar in urls:
            for loc in (en, ar):
                f.write('  <url><loc>%s%s</loc>\n' % (SITE, loc))
                f.write('    <xhtml:link rel="alternate" hreflang="en" href="%s%s"/>\n' % (SITE, en))
                f.write('    <xhtml:link rel="alternate" hreflang="ar" href="%s%s"/>\n' % (SITE, ar))
                f.write('  </url>\n')
        f.write('</urlset>\n')
    with open('i18n/missing.txt', 'w', encoding='utf-8') as f:
        for key in sorted(missing):
            f.write('%s\t%s\n' % (key, ', '.join(sorted(missing[key]))))
    print('Arabic pages: %d · texts without translation: %d (see i18n/missing.txt)' % (len(PAGES), len(missing)))
    if '--check' in sys.argv and missing:
        sys.exit(1)


if __name__ == '__main__':
    main()
