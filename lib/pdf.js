const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * Candidate locations for a Chrome/Chromium/Edge executable.
 * Puppeteer's own cache first, then system-wide installs per platform.
 */
function candidateBrowserPaths() {
  const candidates = [];
  const home = process.env.USERPROFILE || process.env.HOME || '';

  // 1. Puppeteer cache (any version directory), headless shell first.
  const cacheRoots = [
    process.env.PUPPETEER_CACHE_DIR,
    home ? path.join(home, '.cache', 'puppeteer') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'temp') : null
  ].filter(Boolean);

  for (const root of cacheRoots) {
    for (const kind of ['chrome', 'chrome-headless-shell']) {
      const kindDir = path.join(root, kind);
      if (!fs.existsSync(kindDir)) continue;
      for (const entry of fs.readdirSync(kindDir)) {
        candidates.push(
          path.join(kindDir, entry, 'chrome-win64', 'chrome.exe'),
          path.join(kindDir, entry, 'chrome-win64', 'chrome-headless-shell.exe'),
          path.join(kindDir, entry, 'chrome-linux64', 'chrome'),
          path.join(kindDir, entry, 'chrome-linux64', 'chrome-headless-shell'),
          path.join(kindDir, entry, 'chrome-mac', kind === 'chrome' ? 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' : 'chrome-headless-shell')
        );
      }
    }
  }

  // 2. System-installed browsers (Windows).
  for (const base of [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    process.env['ProgramW6432']
  ].filter(Boolean)) {
    candidates.push(
      path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(base, 'Google', 'Chrome Beta', 'Application', 'chrome.exe'),
      path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }

  // 3. Linux/macOS system browsers.
  candidates.push(
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  );

  return candidates;
}

/**
 * Resolve a usable Chrome executable: prefer puppeteer's pinned version,
 * fall back to cache scan and system browsers.
 */
async function resolveChromePath() {
  // Let puppeteer resolve its own pinned browser first — but verify the file
  // actually exists (in puppeteer v25, executablePath() resolves even when
  // the browser was never downloaded; the failure only surfaces at launch).
  try {
    const resolved = await puppeteer.executablePath();
    if (resolved && fs.existsSync(resolved)) return undefined;
  } catch (_) { /* fall through to manual search */ }

  for (const candidate of candidateBrowserPaths()) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch (_) { /* ignore unreadable paths */ }
  }
  return undefined; // nothing found — let puppeteer throw its own clear error
}

/**
 * Generate a PDF from an HTML string using Puppeteer.
 * @param {string} html - The HTML content to render
 * @param {string} outputPath - Where to save the PDF file
 */
async function generatePDF(html, outputPath) {
  const executablePath = await resolveChromePath();
  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.4in',
        bottom: '0.4in',
        left: '0.4in',
        right: '0.4in'
      }
    });
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF };
