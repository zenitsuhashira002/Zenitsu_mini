'use strict';

// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — commands/tomp3.js                ║
// ║         Convert video/mp4 media to mp3 audio                ║
// ║   Local ffmpeg first, remote hosting fallback if needed     ║
// ╚══════════════════════════════════════════════════════════════╝
//
// Strategy:
//   1) PRIMARY   — convert locally via ffmpeg (fast, no network dependency)
//   2) FALLBACK  — if local ffmpeg is unavailable/fails, upload the source
//                  video to a temporary hosting service and use that
//                  service's own conversion/direct-link, cascading through
//                  multiple providers until one succeeds
//   3) Always cleans up temp files, always ends with a reaction-only status
//      plus the final audio — no intermediate progress spam.

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { execFile }  = require('child_process');
const { promisify } = require('util');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const execFileAsync = promisify(execFile);

const CYBERNOVA_CONTEXT = {
  forwardingScore: 355,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid : '120363425394543602@newsletter',
    newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
    serverMessageId: 202,
  },
};

const MAX_AUDIO_MB = 16; // WhatsApp audio limit

// ──────────────────────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────────────────────

async function react(sock, jid, key, emoji) {
  try { await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch (_) {}
}

function locateVideo(msg) {
  const m = msg.message || {};

  if (m.videoMessage) return { mediaMessage: m, quotedInfo: null };
  if (m.documentMessage?.mimetype?.startsWith('video/')) return { mediaMessage: m, quotedInfo: null };

  const ctx = m.extendedTextMessage?.contextInfo || null;
  let quoted = ctx?.quotedMessage;
  if (quoted) {
    if (quoted.viewOnceMessage?.message)   quoted = quoted.viewOnceMessage.message;
    if (quoted.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;

    if (quoted.videoMessage) return { mediaMessage: quoted, quotedInfo: ctx };
    if (quoted.documentMessage?.mimetype?.startsWith('video/')) return { mediaMessage: quoted, quotedInfo: ctx };
  }

  return null;
}

function buildDownloadableMessage(originalMsg, located) {
  const { mediaMessage, quotedInfo } = located;
  if (!quotedInfo) {
    return { key: originalMsg.key, message: mediaMessage };
  }
  const quotedParticipant =
    quotedInfo.participant || originalMsg.key.participant || originalMsg.key.remoteJid;
  return {
    key: {
      remoteJid  : originalMsg.key.remoteJid,
      fromMe     : false,
      id         : quotedInfo.stanzaId || Math.random().toString(36).slice(2),
      participant: quotedParticipant,
    },
    message: mediaMessage,
  };
}

async function robustDownload(sock, originalMsg, located) {
  const attempts = [
    () => buildDownloadableMessage(originalMsg, located),
    () => ({ key: originalMsg.key, message: located.mediaMessage }),
  ];

  for (const build of attempts) {
    try {
      const target = build();
      const buf = await downloadMediaMessage(
        target, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }
      );
      if (buf && buf.length > 0) return buf;
    } catch (_) { /* try next */ }
  }

  // Last resort: force a fresh re-upload from WhatsApp, then retry
  try {
    const refreshed = await sock.updateMediaMessage({
      key: originalMsg.key,
      message: located.mediaMessage,
    });
    const buf = await downloadMediaMessage(
      refreshed, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage }
    );
    if (buf && buf.length > 0) return buf;
  } catch (_) {}

  return null;
}

async function ffmpegBinary() {
  try {
    const p = require('ffmpeg-static');
    if (p) return p;
  } catch (_) {}
  return 'ffmpeg';
}

// ── PRIMARY: local ffmpeg conversion ────────────────────────────
async function convertLocally(inputBuffer) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tomp3-'));
  const inputPath  = path.join(tmpDir, 'in.mp4');
  const outputPath = path.join(tmpDir, 'out.mp3');

  try {
    fs.writeFileSync(inputPath, inputBuffer);
    const ffmpeg = await ffmpegBinary();

    await execFileAsync(ffmpeg, [
      '-i', inputPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      '-y', outputPath,
    ], { timeout: 60000 });

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return fs.readFileSync(outputPath);
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// ── FALLBACK: remote hosting + conversion services (cascaded) ───
// Each uploader returns a Buffer (mp3) or throws/returns null on failure.
// Order = priority. Add/remove services here without touching command logic.

async function uploadToTmpFiles(buffer) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'video.mp4' });
  const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  const url = res.data?.data?.url;
  if (!url) throw new Error('tmpfiles.org: no url returned');
  return url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

async function uploadToCatbox(buffer) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, { filename: 'video.mp4' });
  const res = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  const url = String(res.data).trim();
  if (!url.startsWith('http')) throw new Error('catbox: invalid response');
  return url;
}

async function uploadTo0x0(buffer) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'video.mp4' });
  const res = await axios.post('https://0x0.st', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  const url = String(res.data).trim();
  if (!url.startsWith('http')) throw new Error('0x0.st: invalid response');
  return url;
}

const UPLOAD_PROVIDERS = [
  { name: 'tmpfiles.org', upload: uploadToTmpFiles },
  { name: 'catbox.moe',   upload: uploadToCatbox },
  { name: '0x0.st',       upload: uploadTo0x0 },
];

// Once we have a public URL, convert remotely via ffmpeg pulling the URL
// directly (ffmpeg can read network streams), avoiding a second download
// round-trip through Node.
async function convertFromUrl(url) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tomp3url-'));
  const outputPath = path.join(tmpDir, 'out.mp3');

  try {
    const ffmpeg = await ffmpegBinary();
    await execFileAsync(ffmpeg, [
      '-i', url,
      '-vn',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      '-y', outputPath,
    ], { timeout: 90000 });

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return fs.readFileSync(outputPath);
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function convertViaRemoteFallback(inputBuffer) {
  for (const provider of UPLOAD_PROVIDERS) {
    try {
      const url = await provider.upload(inputBuffer);
      if (!url) continue;

      const mp3 = await convertFromUrl(url);
      if (mp3) return mp3;
    } catch (_) {
      continue; // try next provider
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
//  COMMAND
// ──────────────────────────────────────────────────────────────
module.exports = {
  name    : 'tomp3',
  aliases : ['mp3', 'toaudio', 'videotomp3'],
  category: 'media',

  async execute({ sock, msg, args, jid }) {

    await react(sock, jid, '⏳', msg.key);

    try {
      const located = locateVideo(msg);
      if (!located) {
        await react(sock, jid, '❌', msg.key);
        return;
      }

      const videoBuffer = await robustDownload(sock, msg, located);
      if (!videoBuffer) {
        await react(sock, jid, '❌', msg.key);
        return;
      }

      // 1) PRIMARY: local ffmpeg conversion
      let mp3Buffer = await convertLocally(videoBuffer);

      // 2) FALLBACK: cascaded remote hosting + conversion
      if (!mp3Buffer) {
        mp3Buffer = await convertViaRemoteFallback(videoBuffer);
      }

      if (!mp3Buffer) {
        await react(sock, jid, '❌', msg.key);
        return;
      }

      // Size guard
      const sizeMB = mp3Buffer.length / (1024 * 1024);
      if (sizeMB > MAX_AUDIO_MB) {
        await react(sock, jid, '⚠️', msg.key);
        return;
      }

      await sock.sendMessage(jid, {
        audio: mp3Buffer,
        mimetype: 'audio/mpeg',
        ptt: false,
        contextInfo: CYBERNOVA_CONTEXT,
      }, { quoted: msg });

      await react(sock, jid, '✅', msg.key);

    } catch (e) {
      console.error('[tomp3]', e);
      await react(sock, jid, '❌', msg.key);
    }
  },
};
