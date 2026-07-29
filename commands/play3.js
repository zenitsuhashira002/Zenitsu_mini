'use strict';

const axios = require('axios');

const CYBERNOVA = {
  forwardingScore: 355,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363425394543602@newsletter',
    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    serverMessageId: 202,
  },
};

const MAX_RESULTS = 5;
const MAX_DURATION_SEC = 600;
const TIMEOUT_MS = 40000; // 40s per API
const FALLBACK_THUMBNAIL = 'https://iili.io/COzVllj.jpg';

const activeSearches = new Map();

function parseDuration(dur) {
  if (!dur || dur === 'Unknown') return 0;
  const m = String(dur).match(/(\d+):(\d+)(?::(\d+))?/);
  if (m) return (parseInt(m[1]) || 0) * 60 + (parseInt(m[2]) || 0);
  return 0;
}

function formatDuration(sec) {
  if (!sec) return 'Unknown';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// Search APIs
const searchAPIs = [
  async (q) => {
    const { data } = await axios.get(`https://api.nexray.eu.cc/search/youtube?q=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return data.result?.map(r => ({ title: r.title, id: r.id, duration: r.duration, views: r.views })) || [];
  },
  async (q) => {
    const { data } = await axios.get(`https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return data.results?.map(r => ({ title: r.title, id: r.videoId, duration: r.duration, views: r.views })) || [];
  },
];

// Download APIs (in cascade order: new APIs first, old ones last)
const downloadAPIs = [
  async (url) => {
    const { data } = await axios.get(`https://api.neosoft.best/api/downloader/youtube-play?q=${encodeURIComponent(url)}&type=mp3`, { timeout: TIMEOUT_MS });
    return { url: data.download, title: data.title, thumbnail: data.thumbnail };
  },
  async (url) => {
    const { data } = await axios.get(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.download_url, title: data.result.title, thumbnail: data.result.thumbnail };
  },
  async (url) => {
    const { data } = await axios.get(`https://sylphyy.xyz/download/v2/ytmp3?url=${encodeURIComponent(url)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.dl_url, title: data.result.title };
  },
  async (url) => {
    const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/ytmp3?url=${encodeURIComponent(url)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.download_url, title: data.result.title, thumbnail: data.result.thumbnail };
  },
];

module.exports = {
  name: 'play3',
  aliases: ['ytmp3', 'music'],
  category: 'downloader',

  async execute({ sock, msg, args, jid }) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const input = args.join(' ');

    if (!input) {
      await sock.sendMessage(jid, { text: '❌ Usage: `.play3 <song name>`', contextInfo: CYBERNOVA }, { quoted: msg });
      return;
    }

    // Numeric selection
    if (/^\d+$/.test(input)) {
      const idx = parseInt(input, 10) - 1;
      const cached = activeSearches.get(sender);
      if (!cached || idx < 0 || idx >= cached.results.length) {
        await sock.sendMessage(jid, { text: '❌ Invalid selection.', contextInfo: CYBERNOVA }, { quoted: msg });
        return;
      }
      await downloadMusic(sock, msg, jid, cached.results[idx], input);
      return;
    }

    // Search
    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    let results = [];
    for (const api of searchAPIs) {
      try {
        const res = await api(input);
        if (res?.length) { results = res; break; }
      } catch (_) {}
    }

    if (!results.length) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await sock.sendMessage(jid, { text: '❌ No results found.', contextInfo: CYBERNOVA }, { quoted: msg });
      return;
    }

    const valid = results
      .filter(r => parseDuration(r.duration) <= MAX_DURATION_SEC)
      .slice(0, MAX_RESULTS);

    if (!valid.length) {
      await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } }).catch(() => {});
      await sock.sendMessage(jid, { text: '⚠️ All results exceed 10 minutes.', contextInfo: CYBERNOVA }, { quoted: msg });
      return;
    }

    activeSearches.set(sender, { results: valid, timestamp: Date.now() });

    let text = `🎵 *${input}*\n\n`;
    valid.forEach((r, i) => {
      text += `${i + 1}. ${r.title}\n   ⏱ ${formatDuration(parseDuration(r.duration))}\n\n`;
    });
    text += 'Reply: `.play3 <number>`';

    await sock.sendMessage(jid, { text, contextInfo: CYBERNOVA }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});

    setTimeout(() => activeSearches.delete(sender), 300000);
  },
};

async function downloadMusic(sock, msg, jid, result, userQuery) {
  await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }).catch(() => {});

  const videoUrl = `https://youtube.com/watch?v=${result.id}`;
  let downloaded = null;

  for (const api of downloadAPIs) {
    try {
      const dl = await api(videoUrl);
      const buf = (await axios.get(dl.url, { responseType: 'arraybuffer', timeout: TIMEOUT_MS })).data;
      downloaded = {
        buffer: Buffer.from(buf),
        title: dl.title || userQuery,
        thumbnail: dl.thumbnail || FALLBACK_THUMBNAIL,
      };
      break;
    } catch (_) {}
  }

  if (!downloaded) {
    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    await sock.sendMessage(jid, { text: '❌ Download failed on all servers.', contextInfo: CYBERNOVA }, { quoted: msg });
    return;
  }

  await sock.sendMessage(jid, {
    audio: downloaded.buffer,
    mimetype: 'audio/mpeg',
    ptt: false,
    fileName: `${downloaded.title.substring(0, 80)}.mp3`,
  }, { quoted: msg });

  const sizeKB = (downloaded.buffer.length / 1024).toFixed(0);
  let info = `🎵 *${downloaded.title}*\n📦 ${sizeKB}KB`;

  if (downloaded.thumbnail && downloaded.thumbnail !== FALLBACK_THUMBNAIL) {
    try {
      const thumbBuf = (await axios.get(downloaded.thumbnail, { responseType: 'arraybuffer', timeout: 10000 })).data;
      await sock.sendMessage(jid, {
        image: Buffer.from(thumbBuf),
        caption: info,
        contextInfo: CYBERNOVA,
      });
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
      return;
    } catch (_) {}
  }

  await sock.sendMessage(jid, { text: info, contextInfo: CYBERNOVA }, { quoted: msg });
  await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
}
