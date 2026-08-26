'use strict';
// ╔══════════════════════════════════════════════════════════════╗
// ║         ZENITSU BOT — main.js (CommonJS) v4.1.1             ║
// ║   Session Permanente · Pair Code / QR · Baileys v7 · Render ║
// ║   TOUS LES BOTS SONT ÉGAUX — pas de main bot propriétaire   ║
// ╚══════════════════════════════════════════════════════════════╝
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidGroup,
  getContentType,
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino     = require('pino');
const os       = require('os');
const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const http     = require('http');
const socketIO = require('socket.io');
const qrcode   = require('qrcode'); // npm i qrcode

// ═══════════════════════════════════════
// SANITIZATION
// ═══════════════════════════════════════
function sanitizePrefix(raw, fallback = '.') {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  const candidate = raw.trim().charAt(0);
  if (!candidate || /[a-zA-Z0-9\/\\]/.test(candidate)) return fallback;
  return candidate;
}

// ═══════════════════════════════════════
// AUTO-DÉTECTION DE LA LIMITE MÉMOIRE
// ═══════════════════════════════════════
// L'utilisateur peut déployer sur un plan différent du plan gratuit
// (512MB). La limite doit alors être proportionnelle : 90% de la
// mémoire réellement disponible pour le conteneur, pas une valeur fixe.
function detectMemoryLimitMB() {
  const envOverride = parseInt(process.env.MEMORY_LIMIT_MB);
  if (envOverride) return envOverride;

  // Lecture de la limite cgroup du conteneur (v2 puis v1) — c'est la
  // valeur réelle imposée par l'hébergeur (Render, Railway, Docker, ...).
  const cgroupPaths = [
    '/sys/fs/cgroup/memory.max',                  // cgroup v2
    '/sys/fs/cgroup/memory/memory.limit_in_bytes', // cgroup v1
  ];
  for (const p of cgroupPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8').trim();
        if (raw && raw !== 'max') {
          const bytes = parseInt(raw, 10);
          // On ignore les valeurs aberrantes (souvent "pas de limite" = très grand nombre)
          if (bytes > 0 && bytes < 1024 * 1024 * 1024 * 1024) {
            const totalMb = Math.round(bytes / 1024 / 1024);
            return Math.round(totalMb * 0.9);
          }
        }
      }
    } catch (_) {}
  }

  // Fallback : mémoire totale visible par Node (hôte ou VM)
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  return Math.round(totalMb * 0.9);
}

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const CONFIG = {
  ownerNumber : (process.env.BOT_OWNER || process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, ''),
  OWNER_LID   : process.env.BOT_OWNER_LID || process.env.OWNER_LID || '',
  PREFIX      : sanitizePrefix(process.env.BOT_PREFIX, '.'),
  globalPrefix: sanitizePrefix(process.env.BOT_GLOBAL_PREFIX, '•'),
  subBotsDir  : path.join(__dirname, 'auth', 'subbots'),
  stateDir    : path.join(__dirname, 'auth', 'states'),
  commandsDir : path.join(__dirname, 'commands'),
  eventsDir   : path.join(__dirname, 'events'),
  maxRetries  : 5,
  maxQrRetries: 5,
  keepAliveMs           : 10 * 60 * 1000,
  softRestartMs         : 60 * 60 * 1000,
  connectMessageDelayMs  : 120 * 1000,
  startupDelayMs         : 30 * 1000, // délai anti-détection avant join groupes / activation cmds
  historyMaxEntries      : 50,
  tickIntervalMs         : 60 * 1000,
  pingIntervalMs         : 180 * 1000, // self-ping style uptimerobot
  // Auto-détecté selon le plan réel du conteneur (90% de la RAM dispo).
  memoryLimitMB          : detectMemoryLimitMB(),
  botName     : process.env.BOT_NAME || '𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕4.1.1',
  // Limité à 10 pour éviter le crash mémoire sur le plan gratuit (512MB)
  maxSubBots  : parseInt(process.env.MAX_SUBBOTS) || 10,
  cooldownMinutes: 3,
  channelLink : process.env.BOT_CHANNEL_LINK || 'https://whatsapp.com/channel/REMPLACE_PAR_TON_LIEN_DE_CHAINE',
  groupsToJoin: [
    'https://chat.whatsapp.com/I1oS9uvt89YKTt0zAtZ0Dw',
    'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
    'https://chat.whatsapp.com/KMJOg2l5jLG6VoeBEoBUpO',
  ],
  PORT: parseInt(process.env.PORT) || 3000,
  // URL publique utilisée pour le self-ping (Render fournit RENDER_EXTERNAL_URL / RENDER_EXTERNAL_HOSTNAME)
  selfUrl: process.env.RENDER_EXTERNAL_URL
    || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '')
    || process.env.SELF_URL || '',
};
CONFIG.OWNER_JID = CONFIG.ownerNumber ? CONFIG.ownerNumber + '@s.whatsapp.net' : '';
CONFIG.ownerExplicit = !!(process.env.BOT_OWNER || process.env.OWNER_NUMBER || process.env.BOT_OWNER_LID || process.env.OWNER_LID);

// ═══════════════════════════════════════
// BROWSERS
// ═══════════════════════════════════════
const BROWSERS = [
  ['Linux', 'Chrome', '147.0.7727.137'],
  ['Linux', 'Chrome', '146.0.7708.124'],
  ['Linux', 'Firefox', '143.0'],
  ['Linux', 'Edge', '147.0.3405.102'],
  ['Windows', 'Chrome', '147.0.7727.137'],
  ['Windows', 'Edge', '147.0.3405.102'],
  ['Windows', 'Firefox', '143.0'],
  ['Mac', 'Chrome', '147.0.7727.137'],
  ['Mac', 'Firefox', '143.0'],
];
const getRandomBrowser = () => BROWSERS[Math.floor(Math.random() * BROWSERS.length)];

// ═══════════════════════════════════════
// ZENITSU-THEMED PAIRING CODE
// ═══════════════════════════════════════
// Le code de la commande "code" est exclusivement et toujours "4G4T-SUM4"
// (leetspeak de "AGATSUMA" / hommage à Zenitsu) — ce n'est pas un code
// aléatoire, c'est la signature fixe de ce mode de connexion.
const ZENITSU_FIXED_CODE = '4G4TSUM4';
function generateZenitsuCode() {
  return ZENITSU_FIXED_CODE;
}

// ═══════════════════════════════════════
// GLOBAL STATS
// ═══════════════════════════════════════
const stats = {
  startTime     : Date.now(),
  messagesTotal : 0,
  commandsUsed  : 0,
  eventsHandled : 0,
  reconnections : 0,
  memoryWarnings: 0,
};

// ═══════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════
const logger = pino({ level: 'silent' });
const now  = () => new Date().toLocaleTimeString('fr-FR');
const log  = (tag, msg) => console.log(`\x1b[36m[${now()}]\x1b[0m \x1b[33m[${tag}]\x1b[0m ${msg}`);
const info = (msg)       => console.log(`\x1b[36m[${now()}]\x1b[0m \x1b[32m[INFO]\x1b[0m  ${msg}`);
const warn = (msg)       => console.log(`\x1b[36m[${now()}]\x1b[0m \x1b[33m[WARN]\x1b[0m  ${msg}`);
const err  = (msg)       => console.log(`\x1b[36m[${now()}]\x1b[0m \x1b[31m[ERR]\x1b[0m   ${msg}`);

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return `${d}j ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ═══════════════════════════════════════
// SAFE SEND
// ═══════════════════════════════════════
async function safeSendMessage(sock, jid, content, opts = {}) {
  if (!sock) return null;
  try { return await sock.sendMessage(jid, content, opts); }
  catch (e) { err(`safeSendMessage → ${jid} : ${e.message}`); return null; }
}

// ═══════════════════════════════════════
// CYBERNOVA STYLE
// ═══════════════════════════════════════
const CYBER = {
  forwardingScore: 355,
  newsletterJid: '120363425394543602@newsletter',
  newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
};

// Les messages contenant des boutons/listes/flows interactifs ne doivent PAS
// recevoir le style "forwarded newsletter" : WhatsApp casse le rendu des
// boutons quand le contextInfo est celui d'un message forward de chaîne.
function hasInteractiveContent(content) {
  return !!(
    content.buttons ||
    content.templateButtons ||
    content.interactiveButtons ||
    content.listMessage ||
    content.nativeFlowMessage ||
    (content.interactiveMessage) ||
    (content.sections && content.footer)
  );
}

function withCyberStyle(content, mentions = []) {
  const base = {
    ...content,
    contextInfo: {
      ...(content.contextInfo || {}),
      mentionedJid: [...new Set([...(content.contextInfo?.mentionedJid || []), ...mentions])],
    },
  };

  if (hasInteractiveContent(content)) {
    // On garde uniquement les mentions, pas le style forward, pour ne pas casser les boutons.
    return base;
  }

  base.contextInfo.forwardingScore = CYBER.forwardingScore;
  base.contextInfo.isForwarded = true;
  base.contextInfo.forwardedNewsletterMessageInfo = {
    newsletterJid: CYBER.newsletterJid,
    newsletterName: CYBER.newsletterName,
    serverMessageId: 340,
  };
  return base;
}

async function cyberSend(sock, jid, content, opts = {}, mentions = []) {
  return safeSendMessage(sock, jid, withCyberStyle(content, mentions), opts);
}

async function reactTo(sock, jid, msg, emoji) {
  try { await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

// Envoie le code de pairing en DEUX messages séparés : un avec les
// instructions, un autre avec juste le code brut (facile à copier / à
// surligner seul sur mobile). Utilisé par "pair" et "code".
async function sendPairingCodeMessages(s, requesterJid, cleanNumber, formatted) {
  if (!s || !requesterJid) return;
  await cyberSend(s, requesterJid, {
    text:
      `🔑 *PAIRING CODE — ${cleanNumber}*\n\n` +
      `📱 WhatsApp → Linked devices → Link with phone number\n` +
      `Enter the code below when prompted.`,
  });
  await cyberSend(s, requesterJid, { text: `*${formatted}*` });
}

// ═══════════════════════════════════════
// JID UTILS
// ═══════════════════════════════════════
function normalizeJid(jid) {
  if (!jid) return '';
  const [user, server] = jid.split('@');
  const bareUser = user.split(':')[0];
  return server ? `${bareUser}@${server}` : bareUser;
}

function getSenderJid(msg, sock) {
  if (msg.key.fromMe) return msg.key.participant || sock?.user?.id || msg.key.remoteJid;
  return msg.key.participant || msg.key.remoteJid;
}

function getSenderIdentities(msg, sock) {
  const ids = new Set();
  const k = msg?.key || {};
  const isGroupChat = isJidGroup(k.remoteJid || '');

  if (k.fromMe) {
    if (sock?.user?.id)  ids.add(normalizeJid(sock.user.id));
    if (sock?.user?.lid) ids.add(normalizeJid(sock.user.lid));
  }

  for (const field of ['participant', 'participantAlt', 'participantPn']) {
    if (k[field]) ids.add(normalizeJid(k[field]));
  }

  if (!isGroupChat) {
    for (const field of ['remoteJid', 'remoteJidAlt']) {
      if (k[field]) ids.add(normalizeJid(k[field]));
    }
  }

  return ids;
}

// Résout le vrai numéro (@s.whatsapp.net) de l'expéditeur, jamais son @lid.
// Les @lid font généralement plus de chiffres qu'un numéro de téléphone
// valide (E.164 : 7 à 15 chiffres) — les utiliser tels quels casse la
// vérification WhatsApp ("not registered"). On préfère les variantes
// "PN" (phone number) que Baileys fournit à côté du lid quand disponible.
function getSenderPhoneJid(msg, sock) {
  const k = msg?.key || {};
  const isGroupChat = isJidGroup(k.remoteJid || '');
  const candidates = [
    k.participantPn,
    k.participantAlt,
    isGroupChat ? null : k.remoteJidAlt,
    isGroupChat ? null : k.remoteJid,
    k.participant,
    k.fromMe ? sock?.user?.id : null,
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (!c.includes('@s.whatsapp.net')) continue;
    const num = normalizeJid(c).split('@')[0];
    if (/^[0-9]{7,15}$/.test(num)) return normalizeJid(c);
  }
  return null; // seul un @lid était disponible : impossible de déduire un vrai numéro
}

function getBotKey(sock) {
  const raw = sock?.user?.id || '';
  return normalizeJid(raw).split('@')[0];
}

function selfJidOf(sock) {
  return normalizeJid(sock?.user?.id || '');
}

// ═══════════════════════════════════════
// FIND BOT KEY (pour les commandes owner)
// ═══════════════════════════════════════
function findBotKey(sock) {
  for (const [key, bot] of bots.entries()) {
    if (bot.sock === sock) return key;
  }
  return getBotKey(sock);
}

// ═══════════════════════════════════════
// GLOBAL OWNER CHECK (exporté pour les commandes)
// ═══════════════════════════════════════
function isOwnerGlobal(sock, senderJid, msg = null) {
  const key = findBotKey(sock);
  return isBotOwner(sock, key, senderJid, msg);
}

// ═══════════════════════════════════════
// BOT STATES
// ═══════════════════════════════════════
const botStates = new Map();

function stateFilePath(key) {
  return path.join(CONFIG.stateDir, `${key}.json`);
}

function persistBotState(key) {
  try {
    const st = botStates.get(key);
    if (!st) return;
    fs.mkdirSync(CONFIG.stateDir, { recursive: true });
    const serializable = {
      prefix: st.prefix,
      mode: st.mode,
      antidelete: st.antidelete,
      owners: [...st.owners],
      createdAt: st.createdAt,
      isMain: st.isMain || false,
      disabledChats: [...st.disabledChats],
      browser: st.browser || null,
    };
    const tmpFile = stateFilePath(key) + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(serializable, null, 2));
    fs.renameSync(tmpFile, stateFilePath(key));
  } catch (e) {
    warn(`Sauvegarde état [${key}] échouée : ${e.message}`);
  }
}

function loadPersistedState(key) {
  try {
    const file = stateFilePath(key);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

function ensureBotState(key) {
  if (!botStates.has(key)) {
    const persisted = loadPersistedState(key);
    botStates.set(key, {
      prefix: sanitizePrefix(persisted?.prefix, CONFIG.PREFIX),
      // Mode par défaut "group" pour diminuer le risque de ban.
      mode: ['public', 'private', 'group'].includes(persisted?.mode) ? persisted.mode : 'group',
      antidelete: persisted?.antidelete !== undefined ? persisted.antidelete : false,
      owners: new Set(persisted?.owners || []),
      lastCommandAt: Date.now(),
      lastKeepAliveAt: 0,
      lastRestart: Date.now(),
      createdAt: persisted?.createdAt || Date.now(),
      messageCache: new Map(),
      isMain: persisted?.isMain || false,
      disabledChats: new Set(persisted?.disabledChats || []),
      browser: Array.isArray(persisted?.browser) ? persisted.browser : null,
    });
  }
  return botStates.get(key);
}

// ═══════════════════════════════════════
// OWNER MANAGEMENT
// (Le système addowner/delowner/ownerlist a été retiré : seuls le owner
//  global (env) et le compte fromMe du sub-bot lui-même sont owners.)
// ═══════════════════════════════════════
function getOwnerSet(sock, key) {
  const state = ensureBotState(key);
  const set = new Set();
  if (CONFIG.OWNER_JID) set.add(normalizeJid(CONFIG.OWNER_JID));
  if (CONFIG.OWNER_LID) set.add(normalizeJid(CONFIG.OWNER_LID));
  if (key) set.add(normalizeJid(`${key}@s.whatsapp.net`));
  if (sock?.user?.id)  set.add(normalizeJid(sock.user.id));
  if (sock?.user?.lid) set.add(normalizeJid(sock.user.lid));
  for (const o of state.owners) set.add(o);
  return set;
}

function isBotOwner(sock, key, senderJid, msg = null) {
  if (msg?.key?.fromMe === true) return true;
  const ownerSet = getOwnerSet(sock, key);
  if (ownerSet.has(normalizeJid(senderJid))) return true;
  if (msg) {
    for (const id of getSenderIdentities(msg, sock)) {
      if (ownerSet.has(id)) return true;
    }
  }
  return false;
}

let mainBotKey = null;

function getMainBotKey() {
  if (mainBotKey && bots.has(mainBotKey) && bots.get(mainBotKey).connected) return mainBotKey;
  for (const [key, bot] of bots.entries()) {
    if (bot.connected) {
      mainBotKey = key;
      const st = ensureBotState(key);
      st.isMain = true;
      persistBotState(key);
      return key;
    }
  }
  return null;
}

function setMainBot(key) {
  for (const [k, st] of botStates.entries()) {
    if (st.isMain && k !== key) {
      st.isMain = false;
      persistBotState(k);
    }
  }
  mainBotKey = key;
  const st = ensureBotState(key);
  st.isMain = true;
  persistBotState(key);
  info(`👑 Main bot (affichage) : ${key}`);
}

const GLOBAL_OWNER_FILE = path.join(__dirname, 'auth', 'global-owner.json');

function saveGlobalOwner() {
  try {
    fs.mkdirSync(path.dirname(GLOBAL_OWNER_FILE), { recursive: true });
    fs.writeFileSync(GLOBAL_OWNER_FILE, JSON.stringify({
      ownerNumber: CONFIG.ownerNumber,
      OWNER_JID: CONFIG.OWNER_JID,
      OWNER_LID: CONFIG.OWNER_LID,
    }, null, 2));
  } catch (e) { warn(`Sauvegarde owner général échouée : ${e.message}`); }
}

function loadGlobalOwner() {
  if (CONFIG.ownerExplicit) return;
  try {
    if (!fs.existsSync(GLOBAL_OWNER_FILE)) return;
    const data = JSON.parse(fs.readFileSync(GLOBAL_OWNER_FILE, 'utf8'));
    if (data.ownerNumber) CONFIG.ownerNumber = data.ownerNumber;
    if (data.OWNER_JID)   CONFIG.OWNER_JID   = data.OWNER_JID;
    if (data.OWNER_LID)   CONFIG.OWNER_LID   = data.OWNER_LID;
    if (CONFIG.OWNER_JID || CONFIG.OWNER_LID) info(`👑 Owner général restauré : ${CONFIG.OWNER_JID || CONFIG.OWNER_LID}`);
  } catch (e) { warn(`Lecture owner général échouée : ${e.message}`); }
}

function promoteGlobalOwner(sock, key) {
  if (CONFIG.ownerExplicit) return;
  const pnJid  = sock?.user?.id  ? normalizeJid(sock.user.id)  : '';
  const lidJid = sock?.user?.lid ? normalizeJid(sock.user.lid) : '';
  if (!pnJid && !lidJid) return;
  CONFIG.ownerNumber = pnJid ? pnJid.split('@')[0] : CONFIG.ownerNumber;
  if (pnJid)  CONFIG.OWNER_JID = pnJid;
  if (lidJid) CONFIG.OWNER_LID = lidJid;
  saveGlobalOwner();
  for (const [otherKey, st] of botStates.entries()) {
    let changed = false;
    if (pnJid  && !st.owners.has(pnJid))  { st.owners.add(pnJid);  changed = true; }
    if (lidJid && !st.owners.has(lidJid)) { st.owners.add(lidJid); changed = true; }
    if (changed) persistBotState(otherKey);
  }
  info(`👑 Owner général défini automatiquement : ${pnJid || lidJid}`);
}

// ═══════════════════════════════════════
// CONNECTION COOLDOWNS
// ═══════════════════════════════════════
const connectionCooldowns = new Map();

function isOnCooldown(number) {
  const cooldownMs = CONFIG.cooldownMinutes * 60 * 1000;
  const lastAttempt = connectionCooldowns.get(number) || 0;
  const remaining = (lastAttempt + cooldownMs) - Date.now();
  if (remaining > 0) return { onCooldown: true, remaining: Math.ceil(remaining / 60000) };
  return { onCooldown: false, remaining: 0 };
}

function setCooldown(number) {
  connectionCooldowns.set(number, Date.now());
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════
const HISTORY_FILE = path.join(__dirname, 'auth', 'history.json');
let connectionHistory = [];

function trimHistory() {
  if (connectionHistory.length > CONFIG.historyMaxEntries) {
    connectionHistory = connectionHistory.slice(-CONFIG.historyMaxEntries);
  }
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      connectionHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      trimHistory();
    }
  } catch (_) { connectionHistory = []; }
}

function saveHistory() {
  try {
    trimHistory();
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    const tmpFile = HISTORY_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(connectionHistory, null, 2));
    fs.renameSync(tmpFile, HISTORY_FILE);
  } catch (e) { warn(`Historique non sauvegardé : ${e.message}`); }
}

function addHistory(entry) {
  const record = { ...entry, date: new Date().toISOString() };
  connectionHistory.push(record);
  trimHistory();
  notifyWebInterface('history_update', record);
  saveHistory();
}

// ═══════════════════════════════════════
// "ONLY" — restreindre un salon à un seul sub-bot
// ═══════════════════════════════════════
const ONLY_FILE = path.join(__dirname, 'auth', 'only.json');
let groupOnlyBot = new Map(); // jid -> botKey

function loadOnlyMap() {
  try {
    if (fs.existsSync(ONLY_FILE)) {
      const data = JSON.parse(fs.readFileSync(ONLY_FILE, 'utf8'));
      groupOnlyBot = new Map(Object.entries(data || {}));
    }
  } catch (_) { groupOnlyBot = new Map(); }
}

function saveOnlyMap() {
  try {
    fs.mkdirSync(path.dirname(ONLY_FILE), { recursive: true });
    fs.writeFileSync(ONLY_FILE, JSON.stringify(Object.fromEntries(groupOnlyBot), null, 2));
  } catch (e) { warn(`Sauvegarde "only" échouée : ${e.message}`); }
}

// ═══════════════════════════════════════
// SESSION CLEANUP (fix "already connected" après déconnexion manuelle)
// ═══════════════════════════════════════
function cleanupSessionDir(key) {
  try {
    const dir = path.join(CONFIG.subBotsDir, key);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) { warn(`Nettoyage session (${key}) échoué : ${e.message}`); }
}

// ═══════════════════════════════════════
// WHATSAPP VERIFICATION
// ═══════════════════════════════════════
function getAnyConnectedSock() {
  for (const bot of bots.values()) {
    if (bot.connected && bot.sock?.user) return bot.sock;
  }
  return null;
}

async function verifyOnWhatsApp(number) {
  const sock = getAnyConnectedSock();
  if (!sock) return true;
  try {
    const [res] = await sock.onWhatsApp(number);
    return res?.exists === true;
  } catch (e) { return true; }
}

// ═══════════════════════════════════════
// COMMANDS / EVENTS LOADERS
// ═══════════════════════════════════════
const commands = new Map();
const eventHandlers = new Map();

function loadCommands() {
  const dir = CONFIG.commandsDir;
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return; }
  for (const [name] of commands) {
    try {
      const resolved = require.resolve(path.join(dir, `${name}.js`));
      if (require.cache[resolved]) delete require.cache[resolved];
    } catch (_) {}
  }
  commands.clear();
  let loadedCount = 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (!mod || typeof mod.execute !== 'function') continue;
      const cmdName = (mod.name || file.replace('.js', '')).toLowerCase();
      commands.set(cmdName, mod);

      // Support des alias : "name" reste la seule commande "réelle" affichée
      // dans les menus, les alias pointent vers le même module.
      const rawAliases = mod.alias || mod.aliases || [];
      const aliasList = Array.isArray(rawAliases) ? rawAliases : [rawAliases];
      for (const a of aliasList) {
        if (a && typeof a === 'string') commands.set(a.toLowerCase(), mod);
      }
      loadedCount++;
    } catch (e) { err(`commands/${file} : ${e.message}`); }
  }
  info(`✓ ${loadedCount}/${files.length} commande(s) chargée(s) (alias inclus).`);
}

// Renvoie uniquement les commandes "primaires" (pas les alias), pour les menus.
function getPrimaryCommands() {
  const seen = new Set();
  const list = [];
  for (const [key, mod] of commands.entries()) {
    const primary = (mod.name || key).toLowerCase();
    if (primary === key && !seen.has(mod)) { seen.add(mod); list.push(mod); }
  }
  return list;
}

function loadEvents() {
  const dir = CONFIG.eventsDir;
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return; }
  eventHandlers.clear();
  let loadedCount = 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (!mod || !mod.event || typeof mod.execute !== 'function') continue;
      if (!eventHandlers.has(mod.event)) eventHandlers.set(mod.event, []);
      eventHandlers.get(mod.event).push(mod);
      loadedCount++;
    } catch (e) { err(`events/${file} : ${e.message}`); }
  }

  // ⭐ PRIORITÉ : bot.js en premier pour bloquer les messages
  const priorityOrder = ['messages.upsert'];
  for (const eventName of priorityOrder) {
    const handlers = eventHandlers.get(eventName) || [];
    const botHandler = handlers.find(h => h.name === 'bot');
    if (botHandler) {
      handlers.splice(handlers.indexOf(botHandler), 1);
      handlers.unshift(botHandler);
    }
  }

  info(`✓ ${loadedCount} type(s) d'événement(s) chargé(s) (${eventHandlers.size} handlers).`);
}

async function dispatchEvent(eventName, sock, ...args) {
  stats.eventsHandled++;
  const handlers = eventHandlers.get(eventName) || [];
  for (const h of handlers) {
    try { await h.execute(sock, ...args); } catch (e) { err(`Event handler [${eventName}] : ${e.message}`); }
  }
}

// ═══════════════════════════════════════
// MESSAGE PARSING
// ═══════════════════════════════════════
function extractText(msg) {
  const type = getContentType(msg.message);
  if (!type) return '';
  const content = msg.message[type];
  if (typeof content === 'string') return content;
  if (content?.text)         return content.text;
  if (content?.caption)      return content.caption;
  if (content?.conversation) return content.conversation;
  return '';
}

function getMediaType(msg) {
  const type = getContentType(msg.message);
  const mediaTypes = [
    'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage',
    'stickerMessage', 'ptvMessage', 'voiceMessage',
  ];
  return mediaTypes.includes(type) ? type : null;
}

// ═══════════════════════════════════════
// JOIN GROUPS
// ═══════════════════════════════════════
async function joinBotGroups(sock) {
  if (!sock) return;
  for (const link of CONFIG.groupsToJoin) {
    try {
      const code = link.split('chat.whatsapp.com/')[1];
      if (!code) continue;
      await sock.groupAcceptInvite(code);
      info(`✅ Groupe rejoint : ${link}`);
    } catch (e) { warn(`Groupe non rejoint (${link}) : ${e.message}`); }
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ═══════════════════════════════════════
// SELF CONNECTION MESSAGE
// ═══════════════════════════════════════
async function sendSelfConnectedMessage(sock, label, key) {
  try {
    const selfJid = selfJidOf(sock);
    if (!selfJid) return;
    const state = ensureBotState(key);
    const isMain = state.isMain ? ' (ref bot)' : '';
    setTimeout(async () => {
      await cyberSend(sock, selfJid, {
        text:
          `⚡ *${CONFIG.botName} — ${label} CONNECTED${isMain}*\n` +
          `🕒 ${new Date().toLocaleTimeString('en-US')}\n` +
          `📊 ${commands.size} commands loaded\n` +
          `🔡 Prefix: *${state.prefix}*`,
      }, {}, []);
    }, CONFIG.connectMessageDelayMs);
  } catch (e) { warn(`Message de connexion auto échoué : ${e.message}`); }
}

// ═══════════════════════════════════════
// BOT MANAGEMENT
// ═══════════════════════════════════════
const bots = new Map();
const socketConnections = new Set();

function notifyWebInterface(event, data) {
  for (const socket of socketConnections) {
    try { socket.emit(event, data); } catch (_) {}
  }
}

function softRefreshBot(key, sockRef) {
  const st = ensureBotState(key);
  st.messageCache.clear();
  st.lastRestart = Date.now();
  st.lastCommandAt = Date.now();
  if (sockRef) sockRef.sendPresenceUpdate('available').catch(() => {});
  info(`♻️ Soft refresh — ${key}`);
  addHistory({ type: 'bot', number: key, event: 'soft_refresh' });
  notifyWebInterface('bot_refreshed', { number: key });
}

// ═══════════════════════════════════════
// MEMORY WATCHDOG (avec disjoncteur de connexions)
// ═══════════════════════════════════════
let lastMemoryWarningAt = 0;
let memoryCritical = false; // bloque les nouvelles connexions quand true

function memoryWatchdog() {
  const mem    = process.memoryUsage();
  const rssMB  = Math.round(mem.rss / 1024 / 1024);
  const limitMB = CONFIG.memoryLimitMB;

  // Disjoncteur : on bloque les nouvelles connexions à 90%, on les rouvre sous 75%.
  if (rssMB >= Math.round(limitMB * 0.9)) memoryCritical = true;
  else if (rssMB < Math.round(limitMB * 0.75)) memoryCritical = false;

  if (rssMB < Math.round(limitMB * 0.75)) return;

  const nowTs = Date.now();
  if (nowTs - lastMemoryWarningAt >= 5 * 60 * 1000) {
    lastMemoryWarningAt = nowTs;
    stats.memoryWarnings++;
    warn(`⚠️ Mémoire élevée : RSS ${rssMB}MB / ~${limitMB}MB`);
    for (const st of botStates.values()) st.messageCache.clear();
    if (connectionHistory.length > CONFIG.historyMaxEntries) connectionHistory = connectionHistory.slice(-CONFIG.historyMaxEntries);
    if (typeof global.gc === 'function') try { global.gc(); } catch (_) {}
  }

  if (rssMB >= Math.round(limitMB * 0.9)) {
    err(`🔴 Mémoire critique — sauvegarde préventive.`);
    for (const key of botStates.keys()) persistBotState(key);
    saveHistory();
  }

  // À 95%, on libère de la mémoire en déconnectant le sub-bot le moins actif
  // (jamais le bot de référence) plutôt que de laisser le process crasher.
  if (rssMB >= Math.round(limitMB * 0.95)) {
    const mainKey = getMainBotKey();
    let victim = null;
    let oldestActivity = Infinity;
    for (const [k, st] of botStates.entries()) {
      if (k === mainKey) continue;
      if (!bots.has(k) || !bots.get(k).connected) continue;
      if (st.lastCommandAt < oldestActivity) { oldestActivity = st.lastCommandAt; victim = k; }
    }
    if (victim) {
      err(`🔴 Mémoire critique (${rssMB}MB) — déconnexion préventive de ${victim} pour éviter le crash.`);
      disconnectBot(victim).catch(() => {});
    }
  }
}

async function connectBot(number, { requesterJid = null, customCode = null, useQR = false } = {}) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const key = cleanNumber;

  if (memoryCritical) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ Memory limit reached — new connections are paused for now. Try again in a few minutes.` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: 'Memory limit reached, connections paused' });
    return;
  }

  if (bots.size >= CONFIG.maxSubBots) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `❌ Maximum bots reached (${CONFIG.maxSubBots}).` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `Maximum bots limit reached (${CONFIG.maxSubBots})` });
    return;
  }

  // ✅ autoriser la reconnexion si le bot n'est pas connecté
  if (bots.has(key) && bots.get(key).connected) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ *${cleanNumber}* is already connected.` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `${cleanNumber} is already connected` });
    return;
  }

  if (bots.has(key)) bots.delete(key);

  const cooldownCheck = isOnCooldown(cleanNumber);
  if (cooldownCheck.onCooldown) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) {
      await cyberSend(s, requesterJid, {
        text: `⏳ *${cleanNumber}* is on cooldown. Please wait ${cooldownCheck.remaining} minute(s).`,
      });
    }
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `Cooldown active. Retry in ${cooldownCheck.remaining} min.` });
    return;
  }

  if (!useQR) {
    // Pour le QR, le numéro n'est qu'une clé de session interne — l'appareil
    // qui scanne peut être différent, donc on ne bloque pas sur ce test.
    const exists = await verifyOnWhatsApp(cleanNumber);
    if (!exists) {
      setCooldown(cleanNumber);
      const s = getAnyConnectedSock();
      if (s && requesterJid) {
        await cyberSend(s, requesterJid, {
          text: `❌ *${cleanNumber}* is not registered on WhatsApp.\n⏳ Cooldown: ${CONFIG.cooldownMinutes} minutes.`,
        });
      }
      notifyWebInterface('subbot_error', { number: cleanNumber, error: 'Number not registered on WhatsApp' });
      addHistory({ type: 'bot', number: cleanNumber, event: 'verification_failed' });
      return;
    }
  }

  const s = getAnyConnectedSock();
  if (s && requesterJid) await cyberSend(s, requesterJid, { text: `🔗 Connecting *${cleanNumber}* ${useQR ? '(QR code)' : ''}...` });

  const sessionDir = path.join(CONFIG.subBotsDir, key);
  fs.mkdirSync(sessionDir, { recursive: true });

  const botState = ensureBotState(key);
  setCooldown(cleanNumber);

  // Browser fixé une seule fois par numéro (persisté), pour ne pas afficher
  // plusieurs OS/navigateurs différents sur le même bot d'une reconnexion à l'autre.
  const browser = botState.browser || getRandomBrowser();
  if (!botState.browser) { botState.browser = browser; persistBotState(key); }

  let retry = 0;
  let qrRetryCount = 0;
  let pairRequested = false;

  notifyWebInterface('subbot_connecting', { number: cleanNumber });
  info(`🔗 Connexion du bot : ${cleanNumber}`);

  async function _connect() {
    if (shuttingDown) return;
    let sock;
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version }          = await fetchLatestBaileysVersion();

      sock = makeWASocket({
        version,
        logger,
        auth: {
          creds : state.creds,
          keys  : makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal              : false,
        markOnlineOnConnect            : true,
        syncFullHistory                 : false,
        browser,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 500,
      });

      bots.set(key, {
        sock,
        connected: false,
        createdAt: bots.get(key)?.createdAt || Date.now(),
        browser: browser.join(' / '),
        number: cleanNumber,
        isMain: bots.get(key)?.isMain || false,
      });

      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;

          if (connection === 'connecting' && !sock.authState.creds.registered && !pairRequested && !useQR) {
            pairRequested = true;
            await new Promise(r => setTimeout(r, 5000));
            try {
              const rawCode   = await sock.requestPairingCode(cleanNumber, customCode || undefined);
              const formatted = rawCode.toUpperCase().match(/.{1,4}/g).join('-');

              addHistory({ type: 'bot', number: cleanNumber, event: 'pairing_code', code: formatted, browser: browser.join(' / ') });
              notifyWebInterface('subbot_qr', { number: cleanNumber, code: formatted });

              console.log('\n  \x1b[42m\x1b[30m  PAIRING CODE  \x1b[0m');
              console.log(`  \x1b[1m\x1b[33m  ${formatted}  \x1b[0m`);
              console.log(`  📱 +${cleanNumber}`);
              console.log('  WhatsApp → Linked Devices → Link with pairing code\n');

              const s = getAnyConnectedSock();
              await sendPairingCodeMessages(s, requesterJid, cleanNumber, formatted);
            } catch (e) {
              err(`Pair code (${cleanNumber}) : ${e.message}`);
              pairRequested = false;
              notifyWebInterface('subbot_error', { number: cleanNumber, error: e.message });
            }
          }

          if (qr && useQR && !shuttingDown) {
            qrRetryCount++;
            if (qrRetryCount > CONFIG.maxQrRetries) {
              warn(`QR (${cleanNumber}) : nombre maximum de tentatives atteint.`);
            } else {
              try {
                const qrBuffer = await qrcode.toBuffer(qr, { type: 'png', margin: 1, scale: 6 });
                const s = getAnyConnectedSock();
                if (s && requesterJid) {
                  await cyberSend(s, requesterJid, {
                    image: qrBuffer,
                    caption:
                      `📷 *QR CODE — ${cleanNumber}*\n` +
                      `WhatsApp → Appareils liés → Lier un appareil\n` +
                      `(tentative ${qrRetryCount}/${CONFIG.maxQrRetries})`,
                  });
                }
                addHistory({ type: 'bot', number: cleanNumber, event: 'qr_generated', attempt: qrRetryCount });
                notifyWebInterface('subbot_qr_image', { number: cleanNumber, attempt: qrRetryCount });
              } catch (e) { err(`QR generation (${cleanNumber}) : ${e.message}`); }
            }
          }

          if (connection === 'open') {
            retry = 0;
            pairRequested = false;

            info(`✅ Bot connecté : ${cleanNumber}`);
            addHistory({ type: 'bot', number: cleanNumber, event: 'connected', browser: browser.join(' / ') });

            const stNow = ensureBotState(key);
            stNow.lastCommandAt   = Date.now();
            stNow.lastKeepAliveAt = Date.now();
            stNow.lastRestart     = Date.now();

            const anotherBotAlreadyConnected = [...bots.entries()]
              .some(([k, b]) => k !== key && b.connected);
            if (!anotherBotAlreadyConnected && !(mainBotKey && bots.get(mainBotKey)?.connected)) {
              setMainBot(key);
              promoteGlobalOwner(sock, key);
              info(`👑 Premier bot connecté → référence + owner général : ${cleanNumber}`);
            }

            let ownerCaptured = false;
            if (sock.user?.id) {
              const pnJid = normalizeJid(sock.user.id);
              if (pnJid && !stNow.owners.has(pnJid)) { stNow.owners.add(pnJid); ownerCaptured = true; }
            }
            if (sock.user?.lid) {
              const lidJid = normalizeJid(sock.user.lid);
              if (lidJid && !stNow.owners.has(lidJid)) { stNow.owners.add(lidJid); ownerCaptured = true; }
            }
            if (CONFIG.OWNER_JID) {
              const gJid = normalizeJid(CONFIG.OWNER_JID);
              if (gJid && !stNow.owners.has(gJid)) { stNow.owners.add(gJid); ownerCaptured = true; }
            }
            if (CONFIG.OWNER_LID) {
              const gLid = normalizeJid(CONFIG.OWNER_LID);
              if (gLid && !stNow.owners.has(gLid)) { stNow.owners.add(gLid); ownerCaptured = true; }
            }
            if (ownerCaptured) persistBotState(key);

            notifyWebInterface('subbot_connected', {
              number: cleanNumber,
              mode: stNow.mode,
              prefix: stNow.prefix,
              antidelete: stNow.antidelete,
              browser: browser.join(' / '),
              isMain: stNow.isMain || false,
            });

            if (stNow.isMain) {
              notifyWebInterface('main_connected', {
                number: cleanNumber,
                mode: stNow.mode,
                prefix: stNow.prefix,
                antidelete: stNow.antidelete,
                browser: browser.join(' / '),
              });
            }

            bots.set(key, {
              sock,
              connected: true,
              createdAt: bots.get(key)?.createdAt || Date.now(),
              browser: browser.join(' / '),
              number: cleanNumber,
              isMain: stNow.isMain || false,
            });

            await sendSelfConnectedMessage(sock, `BOT ${cleanNumber}`, key);

            // Délai anti-détection : on attend avant de rejoindre les groupes
            // et d'activer la lecture des commandes/events, pour ne pas
            // éveiller les soupçons de WhatsApp lors de la vérification
            // de l'appareil qui vient de se connecter.
            setTimeout(async () => {
              try {
                joinBotGroups(sock).catch(() => {});
                bindAllEvents(sock, key);
                await dispatchEvent('connection.open', sock);
                info(`🚀 ${cleanNumber} pleinement opérationnel (délai anti-détection écoulé).`);
              } catch (e) { err(`Startup delay actions (${cleanNumber}) : ${e.message}`); }
            }, CONFIG.startupDelayMs);
          }

          if (connection === 'close') {
            const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
            const wasReg = sock.authState.creds.registered;
            const wasMain = bots.get(key)?.isMain;

            addHistory({ type: 'bot', number: cleanNumber, event: 'disconnected', code });
            notifyWebInterface('subbot_disconnected', { number: cleanNumber, code, wasRegistered: wasReg });
            if (wasMain) notifyWebInterface('main_disconnected', { number: cleanNumber });

            if (code === DisconnectReason.loggedOut && wasReg) {
              warn(`Bot ${cleanNumber} : session expirée.`);
              bots.delete(key);
              connectionCooldowns.delete(cleanNumber);
              cleanupSessionDir(key);
              addHistory({ type: 'bot', number: cleanNumber, event: 'session_expired' });

              if (wasMain) {
                mainBotKey = null;
                getMainBotKey();
                notifyMainBotUpdate();
              }

              const s = getAnyConnectedSock();
              if (s && requesterJid) {
                await cyberSend(s, requesterJid, {
                  text: `⚠️ Bot *${cleanNumber}* session expired. Use "pair ${cleanNumber}" to reconnect.`,
                });
              }
              return;
            }

            if (!wasReg && retry >= 2) {
              warn(`Bot ${cleanNumber} : pas enregistré après ${retry} tentatives, abandon.`);
              bots.delete(key);
              connectionCooldowns.delete(cleanNumber);
              cleanupSessionDir(key);
              addHistory({ type: 'bot', number: cleanNumber, event: 'pairing_failed_unregistered' });
              notifyWebInterface('subbot_failed', { number: cleanNumber });
              if (wasMain) { mainBotKey = null; getMainBotKey(); notifyMainBotUpdate(); }
              return;
            }

            if (!shuttingDown && retry < CONFIG.maxRetries) {
              retry++;
              pairRequested = false;
              const delay = Math.min(1000 * 2 ** retry, 30000);
              warn(`Bot ${cleanNumber} : reconnexion ${retry}/${CONFIG.maxRetries} dans ${delay / 1000}s...`);
              stats.reconnections++;
              notifyWebInterface('subbot_reconnecting', { number: cleanNumber, attempt: retry, maxRetries: CONFIG.maxRetries });
              setTimeout(_connect, delay);
            } else if (!shuttingDown) {
              err(`${cleanNumber} : échec après ${CONFIG.maxRetries} tentatives.`);
              bots.delete(key);
              connectionCooldowns.delete(cleanNumber);
              cleanupSessionDir(key);
              addHistory({ type: 'bot', number: cleanNumber, event: 'max_retries_exceeded' });
              notifyWebInterface('subbot_failed', { number: cleanNumber });
              if (wasMain) { mainBotKey = null; getMainBotKey(); notifyMainBotUpdate(); }
              const s = getAnyConnectedSock();
              if (s && requesterJid) {
                await cyberSend(s, requesterJid, { text: `❌ *${cleanNumber}* could not stay connected. Retry with "pair ${cleanNumber}".` });
              }
            }
          }
        } catch (e) { err(`connection.update handler [${cleanNumber}] : ${e.message}`); }
      });

      sock.ev.on('creds.update', saveCreds);
    } catch (e) {
      err(`Erreur de connexion du bot ${cleanNumber} : ${e.message}`);
      if (!shuttingDown && retry < CONFIG.maxRetries) {
        retry++;
        setTimeout(_connect, Math.min(1000 * 2 ** retry, 30000));
      }
    }
  }

  await _connect();
}

async function disconnectBot(number) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = bots.get(cleanNumber);
  if (!bot) return false;

  try { await bot.sock.logout(); } catch (_) { try { await bot.sock.end(); } catch (__) {} }

  bots.delete(cleanNumber);
  connectionCooldowns.delete(cleanNumber);
  // On nettoie complètement la session pour permettre une reconnexion propre
  // sur le même numéro sans devoir redémarrer le service.
  cleanupSessionDir(cleanNumber);
  addHistory({ type: 'bot', number: cleanNumber, event: 'manual_disconnect' });
  notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'manual' });

  if (bot.isMain) { mainBotKey = null; getMainBotKey(); notifyMainBotUpdate(); }
  return true;
}

async function restartBot(number, requesterJid) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = bots.get(cleanNumber);
  const s = getAnyConnectedSock();
  if (!bot) {
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ No bot found for *${cleanNumber}*.` });
    return false;
  }
  softRefreshBot(cleanNumber, bot.sock);
  if (s && requesterJid) await cyberSend(s, requesterJid, { text: `♻️ *${cleanNumber}* refreshed.` });
  return true;
}

function notifyMainBotUpdate() {
  const key = getMainBotKey();
  if (key && bots.has(key)) {
    const bot = bots.get(key);
    const st = ensureBotState(key);
    notifyWebInterface('main_connected', {
      number: key,
      mode: st.mode,
      prefix: st.prefix,
      antidelete: st.antidelete,
      browser: bot.browser,
    });
  } else {
    notifyWebInterface('main_disconnected', { number: null });
  }
}

// ═══════════════════════════════════════
// CENTRAL TICK
// ═══════════════════════════════════════
function centralTick() {
  const nowTs = Date.now();
  for (const [key, bot] of bots.entries()) {
    if (!bot.connected) continue;
    const st = ensureBotState(key);
    if (nowTs - st.lastKeepAliveAt >= CONFIG.keepAliveMs) {
      st.lastKeepAliveAt = nowTs;
      bot.sock.sendPresenceUpdate('available').catch(() => {});
    }
    if (nowTs - st.lastRestart >= CONFIG.softRestartMs) {
      softRefreshBot(key, bot.sock);
    }
  }
  memoryWatchdog();
}

// ═══════════════════════════════════════
// SELF-PING (garde le service en ligne sans moniteur externe)
// ═══════════════════════════════════════
// User-Agent réaliste (navigateur), pas un UA de bot/monitoring — l'objectif
// est que Render voie du trafic "normal" sur le service web pour ne pas
// mettre le programme en veille, comme le ferait un visiteur réel.
const SELF_PING_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function selfPing() {
  if (!CONFIG.selfUrl) return;
  const url = CONFIG.selfUrl.replace(/\/$/, '') + '/ping';
  try {
    const startedAt = Date.now();
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': SELF_PING_USER_AGENT,
        'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    const elapsed = Date.now() - startedAt;
    const headerBits = [];
    res.headers.forEach((v, k) => { if (['server', 'date', 'content-type'].includes(k)) headerBits.push(`${k}=${v}`); });
    info(`📡 Self-ping ${url} → ${res.status} ${res.statusText} (${elapsed}ms) [${headerBits.join(' | ')}]`);
  } catch (e) {
    warn(`📡 Self-ping échoué (${url}) : ${e.message}`);
  }
}

// ═══════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════
let shuttingDown = false;

async function gracefulShutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  warn(`Arrêt demandé (${reason}) — sauvegarde...`);
  try {
    for (const [key, bot] of bots.entries()) {
      try { if (bot.sock) await bot.sock.end(); } catch (_) {}
    }
    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close(() => { info('✓ Serveur web arrêté.'); resolve(); });
        setTimeout(resolve, 2000);
      });
    }
    for (const key of botStates.keys()) persistBotState(key);
    saveHistory();
    saveOnlyMap();
    info('✓ État sauvegardé.');
  } catch (e) { err(`Erreur sauvegarde finale : ${e.message}`); }
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (e) => {
  err(`uncaughtException : ${e.message}`);
  if (!shuttingDown) gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (e) => {
  err(`unhandledRejection : ${e?.message || e}`);
});

// ═══════════════════════════════════════
// UNIVERSAL COMMANDS (toutes préfixées désormais)
// ═══════════════════════════════════════
function resolveTargetNumberFromMention(msg, args, idx = 1) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  if (mentioned) return normalizeJid(mentioned).split('@')[0];
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return normalizeJid(quotedParticipant).split('@')[0];
  return args[idx]?.replace(/[^0-9]/g, '') || '';
}

// cmdName / cmdArgsRaw arrivent déjà débarrassés du préfixe (voir bindAllEvents).
// cmdArgsRaw[0] === cmdName, cmdArgsRaw[1..] sont les paramètres.
async function handleUniversal(sock, msg, cmdName, cmdArgsRaw, jid, senderJid, key) {
  const args  = cmdArgsRaw;
  const state = ensureBotState(key);
  const ownerOk = () => isBotOwner(sock, key, senderJid, msg);

  if (cmdName === 'mode') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const newMode = args[1]?.toLowerCase();
    if (!['public', 'private', 'group'].includes(newMode)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *mode <public|private|group>*\nCurrent: *${state.mode}*` }, { quoted: msg });
      return true;
    }
    state.mode = newMode;
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Mode set to *${newMode}*.` }, { quoted: msg });
    return true;
  }

  if (cmdName === 'setprefix') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const rawNew = args[1];
    if (!rawNew) {
      await cyberSend(sock, jid, { text: `❌ Usage: *setprefix <symbol>*\nCurrent: *${state.prefix}*` }, { quoted: msg });
      return true;
    }
    const prefixChar = rawNew.charAt(0);
    if (/[a-zA-Z0-9\/\\]/.test(prefixChar)) {
      await cyberSend(sock, jid, { text: `❌ Invalid prefix: *${prefixChar}*` }, { quoted: msg });
      return true;
    }
    state.prefix = prefixChar;
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Prefix updated to *${prefixChar}*` }, { quoted: msg });
    return true;
  }

  if (cmdName === 'antidelete') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const toggle = args[1]?.toLowerCase();
    if (toggle === 'on' || toggle === 'off') state.antidelete = toggle === 'on';
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Antidelete is now *${state.antidelete ? 'ON' : 'OFF'}*.` }, { quoted: msg });
    return true;
  }

  if (cmdName === 'bot') {
    // N'importe quel membre peut activer/désactiver le bot dans un salon précis.
    const sub = args[1]?.toLowerCase();
    if (sub !== 'on' && sub !== 'off') {
      await cyberSend(sock, jid, { text: `❌ Usage: *bot on* / *bot off*` }, { quoted: msg });
      return true;
    }
    if (sub === 'off') state.disabledChats.add(jid);
    else state.disabledChats.delete(jid);
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Bot is now *${sub === 'on' ? 'ENABLED' : 'DISABLED'}* in this chat.` }, { quoted: msg });
    return true;
  }

  if (cmdName === 'only') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const sub = args[1]?.toLowerCase();
    if (sub === 'off') {
      groupOnlyBot.delete(jid);
      saveOnlyMap();
      await cyberSend(sock, jid, { text: `✅ "Only" restriction removed for this chat.` }, { quoted: msg });
      return true;
    }
    const targetNumber = resolveTargetNumberFromMention(msg, args, 1);
    if (!targetNumber) {
      await cyberSend(sock, jid, { text: `❌ Usage: *only @bot* (mention or reply to the bot's message), or *only off*.` }, { quoted: msg });
      return true;
    }
    groupOnlyBot.set(jid, targetNumber);
    saveOnlyMap();
    await cyberSend(sock, jid, { text: `✅ Only *+${targetNumber}* will respond to commands in this chat now.` }, { quoted: msg }, [normalizeJid(`${targetNumber}@s.whatsapp.net`)]);
    return true;
  }

  if (cmdName === 'stat') {
    const up = formatUptime(Date.now() - stats.startTime);
    const mem = process.memoryUsage();
    const mainKey = getMainBotKey();
    const reply =
      `╔═════════════════╗\n║   📊 *${CONFIG.botName}*   ║\n╚═════════════════╝\n` +
      `⏱ *Uptime*      : ${up}\n💬 *Messages*    : ${stats.messagesTotal}\n` +
      `⚡ *Commands*    : ${stats.commandsUsed}\n🎯 *Events*      : ${stats.eventsHandled}\n` +
      `🔄 *Reconnects*  : ${stats.reconnections}\n🤖 *Bots*        : ${bots.size}/${CONFIG.maxSubBots}\n` +
      `👑 *Ref. Bot*    : ${mainKey ? '+' + mainKey : 'None'}\n` +
      `🧩 *Mode*        : ${state.mode}\n🔡 *Prefix*      : ${state.prefix}\n` +
      `💾 *Memory*      : ${Math.round(mem.rss / 1024 / 1024)}MB / ${CONFIG.memoryLimitMB}MB`;
    await cyberSend(sock, jid, { text: reply }, { quoted: msg });
    return true;
  }

  if (cmdName === 'alive') { await reactTo(sock, jid, msg, '⚡'); return true; }

  if (cmdName === 'pair') {
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *pair <number>*\nExample: pair +22960000000` }, { quoted: msg });
      return true;
    }
    if (bots.size >= CONFIG.maxSubBots) {
      await cyberSend(sock, jid, { text: `❌ Limit reached: ${CONFIG.maxSubBots} bots max.` }, { quoted: msg });
      return true;
    }
    const cleanTarget = targetNumber.replace(/[^0-9]/g, '');
    connectBot(cleanTarget, { requesterJid: jid }).catch(e => err(`connectBot : ${e.message}`));
    return true;
  }

  if (cmdName === 'code') {
    // Connecte l'expéditeur directement, sans lui demander son numéro.
    // On ne prend JAMAIS le @lid tel quel (trop de chiffres, échoue la
    // vérification WhatsApp) : on résout la vraie variante @s.whatsapp.net.
    // Un numéro explicite en argument reste possible en secours.
    const manualNumber = args[1]?.replace(/[^0-9]/g, '');
    let requesterNumber = manualNumber && /^[0-9]{7,15}$/.test(manualNumber) ? manualNumber : null;
    if (!requesterNumber) {
      const phoneJid = getSenderPhoneJid(msg, sock);
      requesterNumber = phoneJid ? normalizeJid(phoneJid).split('@')[0] : null;
    }
    if (!requesterNumber) {
      await cyberSend(sock, jid, {
        text: `❌ Couldn't detect your real phone number automatically (only a @lid was visible).\nUsage: *code <number>* (with country code).`,
      }, { quoted: msg });
      return true;
    }
    if (bots.size >= CONFIG.maxSubBots) {
      await cyberSend(sock, jid, { text: `❌ Limit reached: ${CONFIG.maxSubBots} bots max.` }, { quoted: msg });
      return true;
    }
    const customCode = generateZenitsuCode();
    connectBot(requesterNumber, { requesterJid: jid, customCode }).catch(e => err(`connectBot (code) : ${e.message}`));
    return true;
  }

  if (cmdName === 'qr') {
    // Le numéro n'est pas requis pour finaliser une connexion QR — l'appareil
    // qui scanne n'en a pas besoin. On s'en sert seulement en interne comme
    // clé de session, donc on le déduit automatiquement (même méthode que
    // "code"), avec un numéro explicite optionnel en secours.
    const manualNumber = args[1]?.replace(/[^0-9]/g, '');
    let cleanTarget = manualNumber && /^[0-9]{7,15}$/.test(manualNumber) ? manualNumber : null;
    if (!cleanTarget) {
      const phoneJid = getSenderPhoneJid(msg, sock);
      cleanTarget = phoneJid ? normalizeJid(phoneJid).split('@')[0] : null;
    }
    if (!cleanTarget) {
      await cyberSend(sock, jid, {
        text: `❌ Couldn't detect a number automatically. Usage: *qr <number>* (optional).`,
      }, { quoted: msg });
      return true;
    }
    if (bots.size >= CONFIG.maxSubBots) {
      await cyberSend(sock, jid, { text: `❌ Limit reached: ${CONFIG.maxSubBots} bots max.` }, { quoted: msg });
      return true;
    }
    connectBot(cleanTarget, { requesterJid: jid, useQR: true }).catch(e => err(`connectBot (qr) : ${e.message}`));
    return true;
  }

  if (cmdName === 'restart') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *restart <number>*` }, { quoted: msg });
      return true;
    }
    await restartBot(targetNumber, jid);
    return true;
  }

  if (cmdName === 'unpair') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber) { await cyberSend(sock, jid, { text: `❌ Usage: *unpair <number>*` }, { quoted: msg }); return true; }
    const done = await disconnectBot(targetNumber);
    await cyberSend(sock, jid, { text: done ? `✅ *${targetNumber}* disconnected.` : `⚠️ No bot found for *${targetNumber}*.` }, { quoted: msg });
    return true;
  }

  if (cmdName === 'subbots' || cmdName === 'bots') {
    if (bots.size === 0) {
      await cyberSend(sock, jid, { text: `🤖 No active bots.` }, { quoted: msg });
    } else {
      const list = [...bots.entries()].map(([k, bot], i) => {
        const st2 = ensureBotState(k);
        const status = bot.connected ? '🟢' : '🟡';
        const mainTag = bot.isMain ? ' 👑' : '';
        return `${i + 1}. ${status} +${k}${mainTag} — mode:${st2.mode} prefix:${st2.prefix} (up ${formatUptime(Date.now() - bot.createdAt)})`;
      }).join('\n');
      await cyberSend(sock, jid, { text: `🤖 *Active bots (${bots.size}/${CONFIG.maxSubBots})*\n\n${list}` }, { quoted: msg });
    }
    return true;
  }

  if (cmdName === 'report') {
    const details = args.slice(1).join(' ').trim() || '(no details)';
    const s = getAnyConnectedSock();
    if (s) await cyberSend(s, CONFIG.OWNER_JID, { text: `🚨 *Report from ${jid}*\n\n${details}` });
    await reactTo(sock, jid, msg, '✅');
    return true;
  }

  return false;
}
// ═══════════════════════════════════════
// BIND ALL EVENTS
// ═══════════════════════════════════════
function bindAllEvents(sock, key) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      await dispatchEvent('messages.upsert', sock, { messages, type });

      for (const msg of messages) {
        if (!msg.message) continue;
        if (isJidBroadcast(msg.key.remoteJid)) continue;

        stats.messagesTotal++;

        const jid       = msg.key.remoteJid;
        const senderJid = getSenderJid(msg, sock);
        const state      = ensureBotState(key);
        const text       = extractText(msg).trim();
        const mediaTyp   = getMediaType(msg);

        // Auto-guérison owners
        if (msg.key.fromMe) {
          let widened = false;
          for (const id of getSenderIdentities(msg, sock)) {
            if (id && !state.owners.has(id)) { state.owners.add(id); widened = true; }
          }
          if (widened) persistBotState(key);
        }

        // Détection préfixe / commande en amont, pour les filtres "only" et "bot off"
        const activePrefix = text.startsWith(state.prefix)        ? state.prefix
                            : text.startsWith(CONFIG.globalPrefix) ? CONFIG.globalPrefix
                            : null;
        const cmdArgsRaw = activePrefix ? text.slice(activePrefix.length).trim().split(/\s+/) : [];
        const cmdNameRaw = (cmdArgsRaw[0] || '').toLowerCase();

        // "only" : un seul sub-bot doit répondre dans ce salon
        const onlyKey = groupOnlyBot.get(jid);
        if (onlyKey && onlyKey !== key && cmdNameRaw !== 'only') continue;

        // "bot off" : ignorer toutes les cmds/events sauf "bot on"
        const isBotToggleOn = activePrefix && cmdNameRaw === 'bot' && (cmdArgsRaw[1] || '').toLowerCase() === 'on';
        if (state.disabledChats.has(jid) && !isBotToggleOn) continue;

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
          await dispatchEvent('onReply', sock, msg);
        }
        if (mediaTyp) await dispatchEvent('onMedia', sock, msg, mediaTyp);
        if (text)     await dispatchEvent('onText', sock, msg, text);

        if (!text || !activePrefix) continue;

        try {
          const handled = await handleUniversal(sock, msg, cmdNameRaw, cmdArgsRaw, jid, senderJid, key);
          if (handled) { stats.commandsUsed++; state.lastCommandAt = Date.now(); continue; }
        } catch (e) {
          err(`Universal handler : ${e.message}`);
          await cyberSend(sock, jid, { text: `❌ Error: ${e.message}` }, { quoted: msg });
        }

        const cmdName = cmdNameRaw;
        const args    = cmdArgsRaw.slice(1);
        if (!cmdName) continue;
        const cmd = commands.get(cmdName);
        if (!cmd) continue;

        if (state.mode === 'private' && !isBotOwner(sock, key, senderJid, msg)) continue;
        if (state.mode === 'group'   && !isJidGroup(jid)) continue;

        // Lecture forcée du message contenant la commande (diminue le risque de ban)
        try { await sock.readMessages([msg.key]); } catch (_) {}

        // Autotyping avant exécution de la commande
        try {
          await sock.sendPresenceUpdate('composing', jid);
          await new Promise(r => setTimeout(r, 1000));
          await sock.sendPresenceUpdate('paused', jid);
        } catch (_) {}

        stats.commandsUsed++;
        state.lastCommandAt = Date.now();

        try {
          await cmd.execute({
            sock, msg, args, jid, senderJid, text,
            config: CONFIG, stats, subBots: bots, bots,
            botKey: key, botState: state,
            isBotOwner: () => isBotOwner(sock, key, senderJid, msg),
          });
        } catch (e) {
          err(`Commande [${cmdName}] : ${e.message}`);
          await cyberSend(sock, jid, { text: `❌ Command *${cmdName}* error:\n${e.message}` }, { quoted: msg });
        }
      }
    } catch (e) { err(`messages.upsert handler [${key}] : ${e.message}`); }
  });
  sock.ev.on('messages.update',           (u) => dispatchEvent('messages.update',           sock, u));
  sock.ev.on('message-receipt.update',    (u) => dispatchEvent('message-receipt.update',    sock, u));
  sock.ev.on('messages.delete',           (u) => dispatchEvent('messages.delete',           sock, u));
  sock.ev.on('messages.reaction',         (u) => dispatchEvent('messages.reaction',         sock, u));
  sock.ev.on('messages.media-update',     (u) => dispatchEvent('messages.media-update',     sock, u));
  sock.ev.on('presence.update',           (u) => dispatchEvent('presence.update',           sock, u));
  sock.ev.on('groups.update',             (u) => dispatchEvent('groups.update',             sock, u));
  sock.ev.on('groups.upsert',             (u) => dispatchEvent('groups.upsert',             sock, u));
  sock.ev.on('group-participants.update', (u) => dispatchEvent('group-participants.update', sock, u));
  sock.ev.on('contacts.upsert',           (u) => dispatchEvent('contacts.upsert',           sock, u));
  sock.ev.on('contacts.update',           (u) => dispatchEvent('contacts.update',           sock, u));
  sock.ev.on('chats.upsert',              (u) => dispatchEvent('chats.upsert',              sock, u));
  sock.ev.on('chats.update',              (u) => dispatchEvent('chats.update',              sock, u));
  sock.ev.on('chats.delete',              (u) => dispatchEvent('chats.delete',              sock, u));
  sock.ev.on('chats.phoneNumberShare',    (u) => dispatchEvent('chats.phoneNumberShare',    sock, u));
  sock.ev.on('blocklist.update',          (u) => dispatchEvent('blocklist.update',          sock, u));
  sock.ev.on('blocklist.set',             (u) => dispatchEvent('blocklist.set',             sock, u));
  sock.ev.on('call',                      (u) => dispatchEvent('call',                      sock, u));
  sock.ev.on('labels.edit',               (u) => dispatchEvent('labels.edit',               sock, u));
  sock.ev.on('labels.association',        (u) => dispatchEvent('labels.association',        sock, u));
  sock.ev.on('newsletters',                (u) => dispatchEvent('newsletters',                sock, u));
}
// ═══════════════════════════════════════
// RESTORE ALL BOTS
// ═══════════════════════════════════════
async function restoreAllBots() {
  const subBotsDir = CONFIG.subBotsDir;
  if (!fs.existsSync(subBotsDir)) { fs.mkdirSync(subBotsDir, { recursive: true }); return; }
  const entries = fs.readdirSync(subBotsDir).filter(e => fs.statSync(path.join(subBotsDir, e)).isDirectory());
  if (entries.length === 0) return;
  info(`🔄 Restauration de ${entries.length} bot(s)...`);
  for (const number of entries) {
    if (bots.size >= CONFIG.maxSubBots) break;
    info(`🔗 Restauration du bot : ${number}`);
    await connectBot(number);
    await new Promise(r => setTimeout(r, 5000));
  }
}

// ═══════════════════════════════════════
// WEB SERVER
// ═══════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { maxHttpBufferSize: 1e8, pingTimeout: 60000 });

app.use((req, res, next) => { if (req.url === '/favicon.ico') return res.status(204).end(); next(); });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/api/stats', (req, res) => {
  const up = formatUptime(Date.now() - stats.startTime);
  const mem = process.memoryUsage();
  const mainKey = getMainBotKey();
  let mainBot = null;
  if (mainKey && bots.has(mainKey)) {
    const bot = bots.get(mainKey);
    const st = ensureBotState(mainKey);
    mainBot = {
      number: mainKey, connected: bot.connected || false,
      mode: st.mode, prefix: st.prefix, antidelete: st.antidelete,
      ownersCount: st.owners.size, browser: bot.browser,
    };
  }
  const subBotsList = [...bots.entries()]
    .filter(([n]) => n !== mainKey)
    .map(([n, bot]) => {
      const st = ensureBotState(n);
      return {
        number: n, connected: bot.connected || false,
        mode: st.mode, prefix: st.prefix, antidelete: st.antidelete,
        ownersCount: st.owners.size, browser: bot.browser,
        uptime: formatUptime(Date.now() - (bot.createdAt || Date.now())),
        createdAt: bot.createdAt, isMain: false,
      };
    });

  res.json({
    status: 'active', uptime: up, uptimeSeconds: process.uptime(), botName: CONFIG.botName,
    memory: { rssMB: Math.round(mem.rss / 1024 / 1024), heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024), limitMB: CONFIG.memoryLimitMB, warnings: stats.memoryWarnings, critical: memoryCritical },
    mainBot: mainBot || { number: null, connected: false, mode: 'group', prefix: CONFIG.PREFIX, antidelete: false, ownersCount: 0 },
    globalPrefix: CONFIG.globalPrefix,
    stats: { messagesTotal: stats.messagesTotal, commandsUsed: stats.commandsUsed, eventsHandled: stats.eventsHandled, reconnections: stats.reconnections },
    subBots: { active: subBotsList.length, max: CONFIG.maxSubBots, list: subBotsList },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/history', (req, res) => { trimHistory(); res.json({ history: [...connectionHistory].reverse() }); });
app.get('/ping', (req, res) => res.json({ status: 'active', uptime: process.uptime(), bots: bots?.size || 0, timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => {
  const isHealthy = bots.size > 0;
  res.status(isHealthy ? 200 : 503).json({ status: isHealthy ? 'ok' : 'degraded', bots: bots.size, uptime: process.uptime() });
});

io.on('connection', (socket) => {
  info(`🔌 Dashboard connected: ${socket.id}`);
  socketConnections.add(socket);
  trimHistory();
  socket.emit('stats_update', { uptime: formatUptime(Date.now() - stats.startTime), messagesTotal: stats.messagesTotal, commandsUsed: stats.commandsUsed, subBotsCount: bots.size, maxSubBots: CONFIG.maxSubBots });
  socket.emit('history_snapshot', [...connectionHistory].reverse());

  socket.on('connect_subbot', async (data) => {
    const targetNumber = (data?.phoneNumber || data?.number || '').replace(/[^0-9]/g, '');
    if (!targetNumber) { socket.emit('subbot_error', { number: 'unknown', error: 'Invalid number' }); return; }
    if (bots.has(targetNumber) && bots.get(targetNumber).connected) { socket.emit('notification', { type: 'warning', message: `${targetNumber} is already connected` }); return; }
    socket.emit('subbot_connecting', { number: targetNumber });
    try { await connectBot(targetNumber, { useQR: !!data?.useQR }); } catch (e) { socket.emit('subbot_error', { number: targetNumber, error: e.message }); }
  });

  socket.on('restart_subbot', async (data) => {
    const number = data?.number;
    if (!number || !bots.has(number)) { socket.emit('notification', { type: 'error', message: `${number} not found` }); return; }
    socket.emit('notification', { type: 'info', message: `Refreshing ${number}...` });
    try { await restartBot(number, null); socket.emit('notification', { type: 'success', message: `${number} refreshed` }); } catch (e) { socket.emit('subbot_error', { number, error: e.message }); }
  });

  socket.on('disconnect_subbot', async (data) => {
    const number = data?.number;
    if (!number) { socket.emit('notification', { type: 'error', message: 'Number required.' }); return; }
    const done = await disconnectBot(number);
    socket.emit('notification', { type: done ? 'success' : 'error', message: done ? `${number} disconnected` : `Error disconnecting ${number}` });
  });

  socket.on('disconnect', () => { info(`🔌 Dashboard disconnected: ${socket.id}`); socketConnections.delete(socket); });
});

// ═══════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════
(async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT v4.1.1 — DÉMARRAGE  \x1b[0m\n');
  info(`💾 Limite mémoire auto-détectée : ${CONFIG.memoryLimitMB}MB (90% de la RAM disponible pour ce conteneur)`);
  [CONFIG.subBotsDir, CONFIG.stateDir, path.dirname(HISTORY_FILE)].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  loadGlobalOwner();
  loadHistory();
  loadOnlyMap();
  loadCommands();
  loadEvents();

  try {
    await new Promise((resolve) => {
      server.listen(CONFIG.PORT, () => {
        info(`🌐 Dashboard démarré sur le port ${CONFIG.PORT}`);
        resolve();
      });
    });
  } catch (e) { err(`Échec serveur : ${e.message}`); }

  restoreAllBots().catch(e => err(`restoreAllBots Error: ${e.message}`));

  setInterval(centralTick, CONFIG.tickIntervalMs);
  setInterval(() => { trimHistory(); saveHistory(); }, 30 * 60 * 1000);

  if (CONFIG.selfUrl) {
    setInterval(selfPing, CONFIG.pingIntervalMs);
    setTimeout(selfPing, 15000);
  } else {
    warn('📡 Self-ping désactivé : définis RENDER_EXTERNAL_URL ou SELF_URL pour l\'activer.');
  }
})();

// ═══════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════
module.exports = {
  commands, eventHandlers, stats, CONFIG, bots, subBots: bots,
  botStates, connectionHistory, groupOnlyBot,
  safeSendMessage, cyberSend, withCyberStyle,
  connectBot, disconnectBot, restartBot,
  getOwnerSet, isBotOwner, ensureBotState,
  normalizeJid, getBotKey, selfJidOf, sanitizePrefix,
  isOwner: isOwnerGlobal,
  findBotKey, getPrimaryCommands, cleanupSessionDir, generateZenitsuCode,
};
