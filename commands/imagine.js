'use strict';

// ╔══════════════════════════════════════════════╗
// ║   IMAGINE — Génération d'images AI          ║
// ║   Pollinations → Flux → Picsum             ║
// ║   Sans API key · Zenitsu Mini              ║
// ╚══════════════════════════════════════════════╝

const NEWSLETTER = {
  forwardingScore: 350,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363425394543602@newsletter',
    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    serverMessageId: 202,
  },
};

// ─── Config providers (personnalisable) ────────
// Pour ajouter / retirer / réordonner un provider :
// modifie simplement le tableau PROVIDERS ci-dessous.

const WIDTH  = 768;
const HEIGHT = 768;
const TIMEOUT_MS = 40000; // 40s max par tentative

const PROVIDERS = [
  {
    name: 'Pollinations',
    emoji: '🌸',
    // Encode le prompt dans l'URL — pas de clé requise
    buildUrl: (prompt) => {
      const encoded = encodeURIComponent(prompt);
      return `https://image.pollinations.ai/prompt/${encoded}?width=${WIDTH}&height=${HEIGHT}&nologo=true&model=flux`;
    },
    // Pollinations retourne directement une image
    extractBuffer: async (res) => {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    },
  },
  {
    name: 'Flux (fal.media)',
    emoji: '⚡',
    // API publique fal.media — sans clé pour le modèle flux-schnell
    buildUrl: (prompt) => {
      const params = new URLSearchParams({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: '4',
        num_images: '1',
        enable_safety_checker: 'true',
      });
      return `https://fal.run/fal-ai/flux/schnell?${params.toString()}`;
    },
    extractBuffer: async (res) => {
      const json = await res.json();
      // fal.media retourne { images: [{ url: "...", ... }] }
      const imgUrl = json?.images?.[0]?.url;
      if (!imgUrl) throw new Error('Pas d\'image dans la réponse Flux');
      const imgRes = await fetchWithTimeout(imgUrl, TIMEOUT_MS);
      const ab     = await imgRes.arrayBuffer();
      return Buffer.from(ab);
    },
  },
  {
    name: 'Picsum (placeholder)',
    emoji: '🖼️',
    // Picsum ne génère pas d'IA mais sert de fallback visuel garanti
    buildUrl: (_prompt) => {
      // Seed aléatoire pour varier les images
      const seed = Math.floor(Math.random() * 1000);
      return `https://picsum.photos/seed/${seed}/${WIDTH}/${HEIGHT}`;
    },
    extractBuffer: async (res) => {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    },
    // Marquer comme fallback non-IA pour le message
    isPlaceholder: true,
  },
];

// ─── Helpers ───────────────────────────────────

async function react(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  } catch (_) {}
}

function newsletterMsg(text) {
  return { text, contextInfo: { ...NEWSLETTER, mentionedJid: [] } };
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ─── Tentative sur un provider ─────────────────

async function tryProvider(provider, prompt) {
  const url = provider.buildUrl(prompt);
  const res  = await fetchWithTimeout(url, TIMEOUT_MS);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = await provider.extractBuffer(res);
  if (!buffer || buffer.length < 1000) throw new Error('Image trop petite / vide');

  return buffer;
}

// ─── Commande principale ───────────────────────

async function handleImagine(sock, msg, args, jid) {
  const prompt = args.join(' ').trim();

  if (!prompt) {
    await react(sock, msg, '💤');
    await sock.sendMessage(jid,
      newsletterMsg(
        '❌ *Usage :* `.imagine <description>`\n\n' +
        '_Exemple :_ `.imagine Handsome boy with yellow jacket`\n' +
        '_Exemple :_ `.imagine cyberpunk city at night, neon lights`'
      ),
      { quoted: msg }
    );
    return;
  }

  if (prompt.length > 500) {
    await react(sock, msg, '💤');
    await sock.sendMessage(jid,
      newsletterMsg('❌ Limit : *500 symbols*.'),
      { quoted: msg }
    );
    return;
  }

  await react(sock, msg, '⏳');

  let imageBuffer  = null;
  let usedProvider = null;
  const errors     = [];

  for (const provider of PROVIDERS) {
    try {
      imageBuffer  = await tryProvider(provider, prompt);
      usedProvider = provider;
      break;
    } catch (e) {
      errors.push(`${provider.name}: ${e.message}`);
      // Petite pause avant de tenter le provider suivant
      await new Promise(r => setTimeout(r, 800));
    }
  }

  if (!imageBuffer || !usedProvider) {
    await react(sock, msg, '💤');
    await sock.sendMessage(jid,
      newsletterMsg(
        '❌ All providers are busy\n\n' +
        errors.map(e => `• ${e}`).join('\n')
      ),
      { quoted: msg }
    );
    return;
  }

  const previewPrompt = prompt.length > 80 ? prompt.slice(0, 77) + '...' : prompt;
  const isPlaceholder = usedProvider.isPlaceholder === true;

  const caption = isPlaceholder
    ? `${usedProvider.emoji} *Image placeholder*\n\n` +
      `⚠️ _Les providers IA sont indisponibles. Image aléatoire affichée._\n` +
      `📝 _Prompt :_ ${previewPrompt}`
    : `${usedProvider.emoji} *Image generated ${usedProvider.name}*\n\n` +
      `📝 _${previewPrompt}_`;

  try {
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption,
      contextInfo: { ...NEWSLETTER, mentionedJid: [] },
    }, { quoted: msg });
    await react(sock, msg, '⚡');
  } catch (e) {
    await react(sock, msg, '💤');
    await sock.sendMessage(jid,
      newsletterMsg(`❌ Error: ${e.message}`),
      { quoted: msg }
    );
  }
}

// ─── Export ────────────────────────────────────

module.exports = {
  name: 'imagine',
  aliases: ['imagine', 'gen', 'ai', 'draw'],
  description: 'Génère une image IA (Pollinations → Flux → Picsum)',
  usage: '.imagine <description>',
  adminOnly: false,
  groupOnly: false,

  // ── Personnalisation facile ──────────────────
  // Pour changer l'ordre du fallback depuis main.js ou config :
  //   const cmd = require('./commands/imagine');
  //   cmd.setProviderOrder(['Flux (fal.media)', 'Pollinations', 'Picsum (placeholder)']);
  setProviderOrder(names) {
    const reordered = [];
    for (const name of names) {
      const p = PROVIDERS.find(p => p.name === name);
      if (p) reordered.push(p);
    }
    // Ajouter les providers non mentionnés à la fin
    for (const p of PROVIDERS) {
      if (!reordered.includes(p)) reordered.push(p);
    }
    PROVIDERS.length = 0;
    PROVIDERS.push(...reordered);
  },

  async execute({ sock, msg, args, jid }) {
    return handleImagine(sock, msg, args, jid);
  },
};
