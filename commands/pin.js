

'use strict';

// ╔══════════════════════════════════════════════╗
// ║   IMG — Web image search                    ║
// ║   Pinterest → Bing Images fallback          ║
// ║   No API key required · Zenitsu Mini        ║
// ╚══════════════════════════════════════════════╝

// Comment ça marche :
// WhatsApp expose une fonction "Search Web" dans la sélection de photo de profil.
// Cette commande reproduit le même comportement côté bot :
//   1. Scrape Pinterest (recherche publique, pas d'auth)
//   2. Fallback Bing Images si Pinterest échoue
// Le bot envoie les images trouvées une par une (max configurable).
// L'user peut envoyer ".img <query> --n=3" pour demander N résultats.

const TIMEOUT_MS  = 20000;
const DEFAULT_MAX = 1; // 1 image par défaut pour éviter le spam
const HARD_MAX    = 5; // max absolu

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36';

// ─── Helpers ───────────────────────────────────

async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  } catch (_) {}
}

function fetchWithTimeout(url, options = {}, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ─── Pinterest scraper ─────────────────────────
// Pinterest expose ses résultats de recherche en JSON dans le HTML de la page.
// On parse le tag <script id="__PWS_INITIAL_PROPS__"> ou <script id="initial-state">

async function searchPinterest(query, maxResults) {
  const url = 'https://www.pinterest.com/search/pins/?q=' +
    encodeURIComponent(query) + '&rs=typed';

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`Pinterest HTTP ${res.status}`);

  const html = await res.text();

  // Extraire les URLs d'images depuis le JSON embarqué
  const imageUrls = [];

  // Méthode 1 : chercher les URLs originals dans le JSON
  // Pattern : "orig":{"url":"https://i.pinimg.com/..."}
  const origPattern = /"orig"\s*:\s*\{[^}]*"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/g;
  let match;
  while ((match = origPattern.exec(html)) !== null && imageUrls.length < maxResults) {
    const url = match[1].replace(/\\u002F/g, '/');
    if (!imageUrls.includes(url)) imageUrls.push(url);
  }

  // Méthode 2 : fallback sur les thumbnails 736x si pas assez
  if (imageUrls.length < maxResults) {
    const thumbPattern = /"736x"\s*:\s*\{[^}]*"url"\s*:\s*"(https:\/\/i\.pinimg\.com\/[^"]+)"/g;
    while ((match = thumbPattern.exec(html)) !== null && imageUrls.length < maxResults) {
      const url = match[1].replace(/\\u002F/g, '/');
      if (!imageUrls.includes(url)) imageUrls.push(url);
    }
  }

  if (imageUrls.length === 0) throw new Error('No images found on Pinterest');

  return imageUrls.slice(0, maxResults);
}

// ─── Bing Images scraper ───────────────────────
// Bing Images expose les URLs dans le HTML via des attributs "m" JSON

async function searchBing(query, maxResults) {
  const url = 'https://www.bing.com/images/search?q=' +
    encodeURIComponent(query) + '&form=HDRSC2&first=1';

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);

  const html = await res.text();
  const imageUrls = [];

  // Bing met les métadonnées dans data-m='{"murl":"..."}' sur chaque tuile
  const pattern = /"murl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null && imageUrls.length < maxResults) {
    const url = match[1];
    if (!imageUrls.includes(url)) imageUrls.push(url);
  }

  if (imageUrls.length === 0) throw new Error('No images found on Bing');

  return imageUrls.slice(0, maxResults);
}

// ─── Téléchargement d'une image ────────────────

async function downloadImage(url) {
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length < 2000) throw new Error('Image too small (probably blocked)');
  return buf;
}

// ─── Commande principale ───────────────────────

module.exports = {
  name: 'img',
  aliases: ['img', 'image', 'search'],
  description: 'Search and send images from the web (Pinterest → Bing)',
  usage: '.img <query> [--n=2]',
  adminOnly: false,
  groupOnly: false,

  async execute({ sock, msg, args, jid }) {
    // Parser les args : détecter --n=X
    let maxResults = DEFAULT_MAX;
    const filteredArgs = [];

    for (const arg of args) {
      const nMatch = arg.match(/^--n=(\d+)$/i);
      if (nMatch) {
        maxResults = Math.min(parseInt(nMatch[1], 10), HARD_MAX);
      } else {
        filteredArgs.push(arg);
      }
    }

    const query = filteredArgs.join(' ').trim();

    if (!query) {
      await react(sock, msg, '💤');
      await sock.sendMessage(jid, {
        text:
          '❌ *Usage:* `.img <search query>`\n\n' +
          '_Examples:_\n' +
          '• `.img sunset beach`\n' +
          '• `.img anime wallpaper --n=3`\n\n' +
          `_Max images per request: ${HARD_MAX}_`,
      }, { quoted: msg });
      return;
    }

    await react(sock, msg, '⏳');

    // ── Recherche avec fallback ──────────────────
    let imageUrls = [];
    let usedProvider = '';
    const errors = [];

    try {
      imageUrls    = await searchPinterest(query, maxResults);
      usedProvider = 'Pinterest';
    } catch (e) {
      errors.push(`Pinterest: ${e.message}`);
      try {
        imageUrls    = await searchBing(query, maxResults);
        usedProvider = 'Bing Images';
      } catch (e2) {
        errors.push(`Bing: ${e2.message}`);
      }
    }

    if (imageUrls.length === 0) {
      await react(sock, msg, '💤');
      await sock.sendMessage(jid, {
        text:
          '❌ *No images found.*\n\n' +
          errors.map(e => `• ${e}`).join('\n') +
          '\n\nTry a different query.',
      }, { quoted: msg });
      return;
    }

    // ── Téléchargement et envoi ──────────────────
    let sent = 0;
    const sendErrors = [];

    for (const imgUrl of imageUrls) {
      try {
        const buffer = await downloadImage(imgUrl);

        const caption = sent === 0
          ? `🔍 *${query}*\n_via ${usedProvider}_ · ${imageUrls.length} result${imageUrls.length > 1 ? 's' : ''}`
          : `🔍 _${query}_ (${sent + 1}/${imageUrls.length})`;

        await sock.sendMessage(jid, {
          image: buffer,
          caption,
        }, { quoted: sent === 0 ? msg : undefined });

        sent++;

        // Pause entre les images pour éviter le rate limit
        if (sent < imageUrls.length) await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        sendErrors.push(e.message);
      }
    }

    if (sent === 0) {
      await react(sock, msg, '💤');
      await sock.sendMessage(jid, {
        text: '❌ Found URLs but failed to download images.\n' +
          sendErrors.slice(0, 10).map(e => `• ${e}`).join('\n'),
      }, { quoted: msg });
      return;
    }

    await react(sock, msg, '⚡');

    // Signaler les échecs partiels si besoin
    if (sendErrors.length > 0 && sent < imageUrls.length) {
      await sock.sendMessage(jid, {
        text: `⚠️ ${sent}/${imageUrls.length} image(s) sent. ${sendErrors.length} failed.`,
      }, { quoted: msg });
    }
  },
};
