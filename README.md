<p align="center">
  <img src="Assets/A-M-T-LOGO.png" width="130" alt="A-M-T logo">
</p>

<h1 align="center">A-M-T | Architectural Modeling Toolkit</h1>

<p align="center"><b>17 free tools for Autodesk Revit: modeling, sheets, dimensions, finishes, printing and AI (MCP).</b></p>

<p align="center">
  <a href="https://github.com/abdallahmostafataha6-blip/A-M-T/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/abdallahmostafataha6-blip/A-M-T?label=release&color=16cce0"></a>
  <a href="https://github.com/abdallahmostafataha6-blip/A-M-T/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/abdallahmostafataha6-blip/A-M-T/total?color=0f6f99"></a>
  <img alt="Revit 2023-2026" src="https://img.shields.io/badge/Revit-2023%20%7C%202024%20%7C%202025%20%7C%202026-1f4e79">
  <img alt="Free" src="https://img.shields.io/badge/price-free-2e7d32">
</p>

<p align="center">
  <a href="https://a-m-t-tools.pages.dev/">Website</a> ·
  <a href="https://a-m-t-tools.pages.dev/ar/">الموقع بالعربي</a> ·
  <a href="https://a-m-t-tools.pages.dev/download.html">Download</a> ·
  <a href="https://a-m-t-tools.pages.dev/tools.html">All tools</a> ·
  <a href="https://a-m-t-tools.pages.dev/changelog.html">Changelog</a> ·
  <a href="https://a-m-t-tools.pages.dev/faq.html">FAQ</a>
</p>

---

## Install

1. Download **A-M-T-Setup** from the [latest release](https://github.com/abdallahmostafataha6-blip/A-M-T/releases/latest).
2. Close Revit and run the setup. If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**.
3. Open Revit and use the **A-M-T** tab. Later updates: **Settings → Check for Updates** inside Revit.

Full steps: [installation guide](https://a-m-t-tools.pages.dev/guides/installation.html).

## Tools

| Panel | Tools |
|---|---|
| Parameters | Renumber · Rename · Numbering with Line (all with a preview before applying) |
| Sheets & Views | Create Sheets · Wet Area Views · Curtain Wall · Master & Parts · **DIMS EX&IN** |
| Print | PDF / DWG export, or everything combined into one PDF |
| Walls | Snap Walls to Grid · Column Dims · CW Types · Join in Views |
| Finishes | Finishes by Room · Room Finish · Create Threshold |
| Settings | Language (English / العربية) · TAP Coloring · Check for Updates |
| MCP | MCP Host: lets Claude, ChatGPT, Cursor and other AI apps read and edit the model, with your approval |

Every tool has a guide with pictures and a video on the [website](https://a-m-t-tools.pages.dev/tools.html).

## Report a problem or suggest an idea

[Open an issue](https://github.com/abdallahmostafataha6-blip/A-M-T/issues/new/choose) (forms in English and Arabic).

---

## This repository

This repository holds the website (Cloudflare Pages deploys it from `main`) and the installers in **Releases**.

| Path | What it is |
|---|---|
| `*.html` | Main pages: home, features, tools, gallery, documentation, download, changelog, FAQ, privacy, contact |
| `guides/` | One guide page per tool, plus the installation guide |
| `ar/` | Arabic site. **Generated** by `tools/build_ar.py`: do not edit by hand |
| `i18n/ar.json` | Arabic translations ("English text": "النص العربي"). `i18n/missing.txt` lists texts still without one |
| `Assets/` | Logo, screenshots, tool icons, videos |
| `Documentation/` | PDF guides |
| `amt-release.js` | Reads the latest GitHub release (version, notes, download link, size, SHA-256, downloads) for every page |
| `amt-site.css` | Shared styles: language switch, Arabic layout, changelog, FAQ |
| `version.json` | Backup update info for the A-M-T updater. **Written automatically** when a release is published |
| `_redirects`, `_headers` | Cloudflare Pages rules (old guide addresses keep working) |
| `.github/workflows/` | `version-json.yml` (release → version.json) and `build-ar.yml` (page change → Arabic pages) |

### Publishing a new version

1. Build the setup (`build.ps1` in the add-in project).
2. On GitHub: **Releases → Draft a new release**, tag `V.x.y.z`, title `A-M-T V x.y.z`.
3. Attach `A-M-T-Setup-x.y.z.exe`.
4. Write the notes: English first, then a line with only `---`, then Arabic. The website and the updater show the part in the reader's language.
5. Publish. The site, the changelog and `version.json` update by themselves.

### Changing a page

Edit the English page. If you add or change text, add its Arabic in `i18n/ar.json` (the Action lists any missing text in `i18n/missing.txt`). The Arabic page is rebuilt automatically after the push.

---

<p align="center">Developed by <a href="https://www.linkedin.com/in/abdallah-m0stafa/">Abdallah Mostafa</a> · © 2026 A-M-T</p>
