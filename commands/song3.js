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

const TIMEOUT_MS = 40000;
const FALLBACK_THUMBNAIL = 'https://iili.io/COzVllj.jpg';

const downloadAPIs = [
  async (q) => {
    const { data } = await axios.get(`https://api.neosoft.best/api/downloader/youtube-play?q=${encodeURIComponent(q)}&type=mp3`, { timeout: TIMEOUT_MS });
    return { url: data.download, title: data.title, thumbnail: data.thumbnail };
  },
  async (q) => {
    const { data } = await axios.get(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.download_url, title: data.result.title, thumbnail: data.result.thumbnail };
  },
  async (q) => {
    const { data } = await axios.get(`https://api-aswin-sparky.koyeb.app/api/downloader/ytv?url=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return { url: data.data.url, title: data.data.title };
  },
  async (q) => {
    const { data } = await axios.get(`https://sylphyy.xyz/download/v2/ytmp3?url=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.dl_url, title: data.result.title };
  },
  async (q) => {
    const { data } = await axios.get(`https://api.nexray.eu.cc/downloader/ytmp3?url=${encodeURIComponent(q)}`, { timeout: TIMEOUT_MS });
    return { url: data.result.download_url, title: data.result.title, thumbnail: data.result.thumbnail };
  },
];

module.exports = {
  name: 'song3',
  aliases: ['download', 'getmusic'],
  category: 'downloader',

  async execute({ sock, msg, args, jid }) {
    const query = args.join(' ');

    if (!query) {
      await sock.sendMessage(jid, { text: '❌ Usage: `.song3 <youtube url or search query>`', contextInfo: CYBERNOVA }, { quoted: msg });
      return;
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    let downloaded = null;

    for (const api of downloadAPIs) {
      try {
        const dl = await api(query);
        const buf = (await axios.get(dl.url, { responseType: 'arraybuffer', timeout: TIMEOUT_MS })).data;
        downloaded = {
          buffer: Buffer.from(buf),
          title: dl.title || query,
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

    // Send audio
    await sock.sendMessage(jid, {
      audio: downloaded.buffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${downloaded.title.substring(0, 80)}.mp3`,
    }, { quoted: msg });

    const sizeKB = (downloaded.buffer.length / 1024).toFixed(0);
    let info = `🎵 *${downloaded.title}*\n📦 ${sizeKB}KB`;

    // Try send with thumbnail
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

    // Fallback: send text only
    await sock.sendMessage(jid, { text: info, contextInfo: CYBERNOVA }, { quoted: msg });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
  },
};
