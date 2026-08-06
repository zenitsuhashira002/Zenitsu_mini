
'use strict';
// ╔══════════════════════════════════════════════════════════════╗
// ║         ZENITSU BOT — main.js (CommonJS) v5.1.0             ║
// ║   Session Permanente · Pair Code · Baileys v7 · Render      ║
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
const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const http     = require('http');
const socketIO = require('socket.io');

// ═══════════════════════════════════════════════════════════════
// SANITIZATION UTILITIES
// ═══════════════════════════════════════════════════════════════
function sanitizePrefix(raw, fallback = '.') {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  const candidate = raw.trim().charAt(0);
  if (!candidate) return fallback;
  if (candidate.includes('/') || candidate.includes('\\')) return fallback;
  if (/[a-zA-Z0-9]/.test(candidate)) return fallback;
  return candidate;
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// 🔥 Aucun numéro propriétaire codé en dur.
//    Le premier owner sera ajouté dynamiquement par le bot lui‑même.
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  // Si vous voulez un super-admin global, définissez BOT_OWNER/BOT_OWNER_LID dans l'environnement.
  // 🔥 CORRIGÉ : plus aucun LID codé en dur par défaut. Sans variable d'env,
  //    ce champ reste vide — chaque bot n'a que SES PROPRES owners, jamais
  //    un LID d'un tiers imposé globalement (c'était le bug racine).
  ownerNumber : (process.env.BOT_OWNER || process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, ''),
  OWNER_LID   : process.env.BOT_OWNER_LID || process.env.OWNER_LID || '',
  PREFIX      : sanitizePrefix(process.env.BOT_PREFIX, '.'),
  globalPrefix: sanitizePrefix(process.env.BOT_GLOBAL_PREFIX, '•'),
  subBotsDir  : path.join(__dirname, 'auth', 'subbots'),
  stateDir    : path.join(__dirname, 'auth', 'states'),
  commandsDir : path.join(__dirname, 'commands'),
  eventsDir   : path.join(__dirname, 'events'),
  maxRetries  : 5,
  keepAliveMs           : 10 * 60 * 1000,
  softRestartMs         : 60 * 60 * 1000,
  connectMessageDelayMs  : 120 * 1000,
  historyMaxEntries      : 50,
  tickIntervalMs         : 60 * 1000,
  memoryLimitMB          : parseInt(process.env.MEMORY_LIMIT_MB) || 350,
  botName     : process.env.BOT_NAME || '𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕4.0.2',
  maxSubBots  : parseInt(process.env.MAX_SUBBOTS) || 15,
  cooldownMinutes: 3,
  groupsToJoin: [
    'https://chat.whatsapp.com/I1oS9uvt89YKTt0zAtZ0Dw',
    'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
    'https://chat.whatsapp.com/KMJOg2l5jLG6VoeBEoBUpO',
  ],
  PORT: parseInt(process.env.PORT) || 3000,
};
CONFIG.OWNER_JID = CONFIG.ownerNumber ? CONFIG.ownerNumber + '@s.whatsapp.net' : '';

// ═══════════════════════════════════════════════════════════════
// BROWSER FINGERPRINTS
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATS
// ═══════════════════════════════════════════════════════════════
const stats = {
  startTime     : Date.now(),
  messagesTotal : 0,
  commandsUsed  : 0,
  eventsHandled : 0,
  reconnections : 0,
  memoryWarnings: 0,
};

// ═══════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// SAFE MESSAGE SENDING
// ═══════════════════════════════════════════════════════════════
async function safeSendMessage(sock, jid, content, opts = {}) {
  if (!sock) return null;
  try {
    return await sock.sendMessage(jid, content, opts);
  } catch (e) {
    err(`safeSendMessage → ${jid} : ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CYBERNOVA STYLING
// ═══════════════════════════════════════════════════════════════
const CYBER = {
  forwardingScore: 355,
  newsletterJid: '120363425394543602@newsletter',
  newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
};

function withCyberStyle(content, mentions = []) {
  return {
    ...content,
    contextInfo: {
      ...(content.contextInfo || {}),
      mentionedJid: [...new Set([...(content.contextInfo?.mentionedJid || []), ...mentions])],
      forwardingScore: CYBER.forwardingScore,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: CYBER.newsletterJid,
        newsletterName: CYBER.newsletterName,
        serverMessageId: 340,
      },
    },
  };
}

async function cyberSend(sock, jid, content, opts = {}, mentions = []) {
  return safeSendMessage(sock, jid, withCyberStyle(content, mentions), opts);
}

async function reactTo(sock, jid, msg, emoji) {
  try { await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
// JID UTILITIES
// ═══════════════════════════════════════════════════════════════
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

function getBotKey(sock) {
  const raw = sock?.user?.id || '';
  return normalizeJid(raw).split('@')[0];
}

function selfJidOf(sock) {
  return normalizeJid(sock?.user?.id || '');
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENT BOT STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════
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
      mode: ['public', 'private', 'group'].includes(persisted?.mode) ? persisted.mode : 'public',
      antidelete: persisted?.antidelete !== undefined ? persisted.antidelete : false,
      owners: new Set(persisted?.owners || []),
      lastCommandAt: Date.now(),
      lastKeepAliveAt: 0,
      lastRestart: Date.now(),
      createdAt: persisted?.createdAt || Date.now(),
      messageCache: new Map(),
      isMain: persisted?.isMain || false,
    });
  }
  return botStates.get(key);
}

function deleteBotState(key) {
  botStates.delete(key);
  try {
    const file = stateFilePath(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (_) {}
}

// 🔥 Owners = le bot lui‑même + éventuellement un super‑admin global (si défini)
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
  // 🔥 CORRECTIF OWNER (le plus important) : un message avec fromMe === true
  // ne peut venir QUE du compte lié au bot lui-même (garantie Baileys/WhatsApp).
  // C'est donc TOUJOURS le vrai propriétaire, peu importe la forme du JID
  // (PN vs LID) que WhatsApp a choisi d'exposer pour ce message précis.
  // Ça corrige à la racine le cas "le linker de son propre bot ne peut pas
  // utiliser mode/setprefix" sans dépendre d'un matching de chaîne fragile.
  if (msg?.key?.fromMe === true) return true;
  return getOwnerSet(sock, key).has(normalizeJid(senderJid));
}

// ═══════════════════════════════════════════════════════════════
// 🔥 RÉFÉRENCE « MAIN BOT » (uniquement pour l'interface web)
//    Le premier bot connecté est affiché comme "main".
//    Aucun privilège, purement cosmétique.
// ═══════════════════════════════════════════════════════════════
let mainBotKey = null;

function getMainBotKey() {
  // Cherche un bot marqué comme main dans les états
  if (mainBotKey && bots.has(mainBotKey) && bots.get(mainBotKey).connected) {
    return mainBotKey;
  }

  // Sinon, prend le premier bot connecté
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
  // Retire le flag main de tous les autres bots
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

// ═══════════════════════════════════════════════════════════════
// CONNECTION COOLDOWNS (anti-spam pairing)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// ANTI-SPAM CONNECTION MESSAGE
// ═══════════════════════════════════════════════════════════════
const connectionMessageThrottle = new Map();
const THROTTLE_TIME = 30000;

function shouldSendConnectionMessage(key) {
  const t = Date.now();
  const last = connectionMessageThrottle.get(key) || 0;
  if (t - last >= THROTTLE_TIME) {
    connectionMessageThrottle.set(key, t);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION HISTORY (limité à 50 entrées max)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// WHATSAPP VERIFICATION
// ═══════════════════════════════════════════════════════════════
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
  } catch (e) {
    warn(`Vérification onWhatsApp échouée pour ${number} : ${e.message}`);
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// COMMAND LOADER
// ═══════════════════════════════════════════════════════════════
const commands = new Map();

function loadCommands() {
  const dir = CONFIG.commandsDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    warn(`Dossier ${CONFIG.commandsDir} créé (vide).`);
    return;
  }

  for (const [name] of commands) {
    const filePath = path.join(dir, `${name}.js`);
    try {
      const resolved = require.resolve(filePath);
      if (require.cache[resolved]) delete require.cache[resolved];
    } catch (_) {}
  }
  commands.clear();

  let loadedCount = 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));

  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (!mod) { warn(`commands/${file} : module vide`); continue; }
      const cmdName = mod.name || file.replace('.js', '');
      if (!cmdName || typeof mod.execute !== 'function') {
        warn(`commands/${file} : export invalide (name + execute() requis).`);
        continue;
      }
      commands.set(cmdName.toLowerCase(), mod);
      loadedCount++;
    } catch (e) {
      err(`commands/${file} : ${e.message}`);
    }
  }
  info(`✓ ${loadedCount}/${files.length} commande(s) chargée(s).`);
}

// ═══════════════════════════════════════════════════════════════
// EVENT LOADER
// ═══════════════════════════════════════════════════════════════
const eventHandlers = new Map();

function loadEvents() {
  const dir = CONFIG.eventsDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    warn(`Dossier ${CONFIG.eventsDir} créé (vide).`);
    return;
  }

  eventHandlers.clear();

  let loadedCount = 0;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));

  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (!mod) { warn(`events/${file} : module vide`); continue; }
      const eventName = mod.event;
      if (!eventName || typeof mod.execute !== 'function') {
        warn(`events/${file} : export invalide (event + execute() requis).`);
        continue;
      }
      if (!eventHandlers.has(eventName)) eventHandlers.set(eventName, []);
      eventHandlers.get(eventName).push(mod);
      loadedCount++;
    } catch (e) {
      err(`events/${file} : ${e.message}`);
    }
  }
  info(`✓ ${loadedCount} type(s) d'événement(s) chargé(s) (${eventHandlers.size} handlers).`);
}

async function dispatchEvent(eventName, sock, ...args) {
  stats.eventsHandled++;
  const handlers = eventHandlers.get(eventName) || [];
  for (const h of handlers) {
    try {
      await h.execute(sock, ...args);
    } catch (e) {
      err(`Event handler [${eventName}] : ${e.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE PARSING UTILITIES
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// JOIN GROUPS
// ═══════════════════════════════════════════════════════════════
async function joinBotGroups(sock) {
  if (!sock) return;
  for (const link of CONFIG.groupsToJoin) {
    try {
      const code = link.split('chat.whatsapp.com/')[1];
      if (!code) continue;
      await sock.groupAcceptInvite(code);
      info(`✅ Groupe rejoint : ${link}`);
    } catch (e) {
      warn(`Groupe non rejoint (${link}) : ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

// ═══════════════════════════════════════════════════════════════
// SELF CONNECTION MESSAGE
// ═══════════════════════════════════════════════════════════════
async function sendSelfConnectedMessage(sock, label, key) {
  try {
    const selfJid = selfJidOf(sock);
    if (!selfJid) return;
    const state = ensureBotState(key);
    const isMain = state.isMain ? ' (ref bot)' : '';

    setTimeout(async () => {
      if (!shouldSendConnectionMessage(`connmsg:${selfJid}`)) return;
      await cyberSend(sock, selfJid, {
        text:
          `⚡ *${CONFIG.botName} — ${label} CONNECTED${isMain}*\n` +
          `🕒 ${new Date().toLocaleTimeString('en-US')}\n` +
          `📊 ${commands.size} commands loaded\n` +
          `🔡 Prefix: *${state.prefix}*`,
      }, {}, []);
    }, CONFIG.connectMessageDelayMs);
  } catch (e) {
    warn(`Message de connexion auto échoué : ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED BOT MANAGEMENT
// 🔥 Tous les bots sont indépendants et égaux.
//    Le premier connecté est juste affiché comme "référence".
// ═══════════════════════════════════════════════════════════════
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

/**
 * 🔥 Connecte UN bot.
 *    - Le premier bot connecté devient le bot de référence pour l'interface (mainBotKey).
 *    - Aucun numéro n'est connecté automatiquement.
 */
async function connectBot(number, { requesterJid = null } = {}) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const key = cleanNumber;

  if (bots.size >= CONFIG.maxSubBots) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `❌ Maximum bots reached (${CONFIG.maxSubBots}).` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `Maximum bots limit reached (${CONFIG.maxSubBots})` });
    return;
  }

  if (bots.has(key)) {
    const s = getAnyConnectedSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ *${cleanNumber}* is already connected.` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `${cleanNumber} is already connected` });
    return;
  }

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

  const s = getAnyConnectedSock();
  if (s && requesterJid) await cyberSend(s, requesterJid, { text: `🔗 Connecting *${cleanNumber}* ...` });

  const sessionDir = path.join(CONFIG.subBotsDir, key);
  fs.mkdirSync(sessionDir, { recursive: true });

  ensureBotState(key);
  setCooldown(cleanNumber);

  let retry = 0;
  let pairRequested = false;

  // Premier bot connecté → devient la référence pour l'affichage
  const isFirstBot = bots.size === 0;
  if (isFirstBot) {
    setMainBot(key);
    info(`👑 Premier bot → référence d'affichage : ${cleanNumber}`);
  }

  notifyWebInterface('subbot_connecting', { number: cleanNumber });
  info(`🔗 Connexion du bot : ${cleanNumber}`);

  async function _connect() {
    if (shuttingDown) return;
    let sock;
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version }          = await fetchLatestBaileysVersion();
      const browser = getRandomBrowser();

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
        isMain: isFirstBot || (bots.get(key)?.isMain || false),
      });

      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect } = update;

          if (connection === 'connecting' && !sock.authState.creds.registered && !pairRequested) {
            pairRequested = true;
            await new Promise(r => setTimeout(r, 5000));
            try {
              const rawCode   = await sock.requestPairingCode(cleanNumber);
              const formatted = rawCode.toUpperCase().match(/.{1,4}/g).join('-');

              addHistory({ type: 'bot', number: cleanNumber, event: 'pairing_code', code: formatted, browser: browser.join(' / ') });
              notifyWebInterface('subbot_qr', { number: cleanNumber, code: formatted });

              console.log('\n  \x1b[42m\x1b[30m  PAIRING CODE  \x1b[0m');
              console.log('  \x1b[1m\x1b[33m   ${formatted}   \x1b[0m');
              console.log(`  📱 +${cleanNumber}`);
              console.log('  WhatsApp → Linked Devices → Link with pairing code\n');

              const s = getAnyConnectedSock();
              if (s && requesterJid) {
                await cyberSend(s, requesterJid, {
                  text:
                    `🔑 *PAIRING CODE — ${cleanNumber}*\n\n` +
                    `┌─────────────────┐\n` +
                    `│   *${formatted}*   │\n` +
                    `└─────────────────┘\n\n` +
                    `📱 WhatsApp → Linked devices → Link with phone number`,
                });
              }
            } catch (e) {
              err(`Pair code (${cleanNumber}) : ${e.message}`);
              pairRequested = false;
              notifyWebInterface('subbot_error', { number: cleanNumber, error: e.message });
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

            // 🔥 CORRECTIF OWNER : capture et persiste définitivement l'identité
            // réelle (PN + LID) de la personne qui vient de lier ce bot. Cela
            // survit même si sock.user.lid redevient temporairement absent
            // lors d'une reconnexion ultérieure — l'identité est figée ici.
            let ownerCaptured = false;
            if (sock.user?.id) {
              const pnJid = normalizeJid(sock.user.id);
              if (pnJid && !stNow.owners.has(pnJid)) { stNow.owners.add(pnJid); ownerCaptured = true; }
            }
            if (sock.user?.lid) {
              const lidJid = normalizeJid(sock.user.lid);
              if (lidJid && !stNow.owners.has(lidJid)) { stNow.owners.add(lidJid); ownerCaptured = true; }
            }
            if (ownerCaptured) {
              persistBotState(key);
              info(`👑 Owner capturé automatiquement pour ${cleanNumber} (PN+LID persistés).`);
            }

            notifyWebInterface('subbot_connected', {
              number: cleanNumber,
              mode: stNow.mode,
              prefix: stNow.prefix,
              antidelete: stNow.antidelete,
              browser: browser.join(' / '),
              isMain: bots.get(key)?.isMain || false,
            });

            // Met à jour l'affichage du "main bot" si c'est le premier
            if (bots.get(key)?.isMain) {
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
              isMain: bots.get(key)?.isMain || false,
            });

            await sendSelfConnectedMessage(sock, `BOT ${cleanNumber}`, key);
            joinBotGroups(sock).catch(() => {});
            bindAllEvents(sock, key);
            await dispatchEvent('connection.open', sock);
          }

          if (connection === 'close') {
            const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
            const wasReg = sock.authState.creds.registered;
            const wasMain = bots.get(key)?.isMain;

            addHistory({ type: 'bot', number: cleanNumber, event: 'disconnected', code });
            notifyWebInterface('subbot_disconnected', { number: cleanNumber, code, wasRegistered: wasReg });

            if (wasMain) {
              notifyWebInterface('main_disconnected', { number: cleanNumber });
            }

            if (code === DisconnectReason.loggedOut && wasReg) {
              warn(`Bot ${cleanNumber} : session expirée.`);
              bots.delete(key);
              deleteBotState(key);
              connectionCooldowns.delete(cleanNumber);
              addHistory({ type: 'bot', number: cleanNumber, event: 'session_expired' });

              // Si c'était la référence, on en choisit une autre
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
              deleteBotState(key);
              connectionCooldowns.delete(cleanNumber);
              addHistory({ type: 'bot', number: cleanNumber, event: 'pairing_failed_unregistered' });
              notifyWebInterface('subbot_failed', { number: cleanNumber });

              if (wasMain) {
                mainBotKey = null;
                getMainBotKey();
                notifyMainBotUpdate();
              }
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
              deleteBotState(key);
              connectionCooldowns.delete(cleanNumber);
              addHistory({ type: 'bot', number: cleanNumber, event: 'max_retries_exceeded' });
              notifyWebInterface('subbot_failed', { number: cleanNumber });

              if (wasMain) {
                mainBotKey = null;
                getMainBotKey();
                notifyMainBotUpdate();
              }

              const s = getAnyConnectedSock();
              if (s && requesterJid) {
                await cyberSend(s, requesterJid, { text: `❌ *${cleanNumber}* could not stay connected. Retry with "pair ${cleanNumber}".` });
              }
            }
          }
        } catch (e) {
          err(`connection.update handler [${cleanNumber}] : ${e.message}`);
        }
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

// ═══════════════════════════════════════════════════════════════
// DISCONNECT / RESTART
// ═══════════════════════════════════════════════════════════════
async function disconnectBot(number) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = bots.get(cleanNumber);
  if (!bot) return false;

  const wasMain = bot.isMain;

  try {
    await bot.sock.logout();
  } catch (_) {
    try { await bot.sock.end(); } catch (__) {}
  }

  bots.delete(cleanNumber);
  deleteBotState(cleanNumber);
  connectionCooldowns.delete(cleanNumber);
  addHistory({ type: 'bot', number: cleanNumber, event: 'manual_disconnect' });
  notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'manual' });

  if (wasMain) {
    mainBotKey = null;
    getMainBotKey();
    notifyMainBotUpdate();
  }

  return true;
}

async function restartBot(number, requesterJid) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = bots.get(cleanNumber);
  const s = getAnyConnectedSock();

  if (!bot) {
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ No bot found for *${cleanNumber}*. Use "pair ${cleanNumber}".` });
    return false;
  }

  softRefreshBot(cleanNumber, bot.sock);

  if (s && requesterJid) {
    await cyberSend(s, requesterJid, { text: `♻️ *${cleanNumber}* refreshed — cache cleared.` });
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// CENTRAL TICK
// ═══════════════════════════════════════════════════════════════
function centralTick() {
  const nowTs = Date.now();

  for (const [key, bot] of bots.entries()) {
    if (!bot.connected) continue;
    const st = ensureBotState(key);

    if (nowTs - st.lastKeepAliveAt >= CONFIG.keepAliveMs) {
      st.lastKeepAliveAt = nowTs;
      bot.sock.sendPresenceUpdate('available').catch(() => {});
      if (bot.isMain) {
        info(`⚡ KeepAlive — uptime: ${formatUptime(nowTs - stats.startTime)} | msgs: ${stats.messagesTotal} | bots ${bots.size}`);
      }
    }

    if (nowTs - st.lastRestart >= CONFIG.softRestartMs) {
      softRefreshBot(key, bot.sock);
    }
  }

  memoryWatchdog();
}

// ═══════════════════════════════════════════════════════════════
// MEMORY WATCHDOG
// ═══════════════════════════════════════════════════════════════
let lastMemoryWarningAt = 0;

function memoryWatchdog() {
  const mem    = process.memoryUsage();
  const rssMB  = Math.round(mem.rss / 1024 / 1024);
  const limitMB = CONFIG.memoryLimitMB;

  if (rssMB < Math.round(limitMB * 0.75)) return;

  const nowTs = Date.now();
  if (nowTs - lastMemoryWarningAt < 5 * 60 * 1000) return;
  lastMemoryWarningAt = nowTs;
  stats.memoryWarnings++;

  warn(`⚠️ Mémoire élevée : RSS ${rssMB}MB / ~${limitMB}MB`);

  for (const st of botStates.values()) st.messageCache.clear();
  if (connectionHistory.length > CONFIG.historyMaxEntries) {
    connectionHistory = connectionHistory.slice(-CONFIG.historyMaxEntries);
  }

  if (typeof global.gc === 'function') {
    try { global.gc(); } catch (_) {}
  }

  if (rssMB >= Math.round(limitMB * 0.9)) {
    err(`🔴 Mémoire critique — sauvegarde préventive.`);
    for (const key of botStates.keys()) persistBotState(key);
    saveHistory();
  }
}

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════
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
    info('✓ État sauvegardé.');
  } catch (e) {
    err(`Erreur sauvegarde finale : ${e.message}`);
  }

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

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL COMMANDS
// ═══════════════════════════════════════════════════════════════
function resolveTargetNumberFromMention(msg, args, idx = 1) {
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  if (mentioned) return normalizeJid(mentioned).split('@')[0];
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant) return normalizeJid(quotedParticipant).split('@')[0];
  return args[idx]?.replace(/[^0-9]/g, '') || '';
}

async function handleUniversal(sock, msg, text, jid, senderJid, key) {
  const lower = text.trim().toLowerCase();
  const args  = text.trim().split(/\s+/);
  const state = ensureBotState(key);
  const ownerOk = () => isBotOwner(sock, key, senderJid, msg);

  if (args[0]?.toLowerCase() === 'addowner') {
    const num = resolveTargetNumberFromMention(msg, args);
    if (!num) { await reactTo(sock, jid, msg, '❌'); return true; }

    // 🔥 AUTO-REVENDICATION : si le numéro ciblé est EXACTEMENT celui de CE bot
    // (ex: bot 50912345678, commande "addowner 50912345678"), n'importe qui
    // peut se déclarer owner de SON PROPRE bot — alternative fiable quand la
    // détection automatique (PN/LID) échoue après déploiement. Le vrai JID/LID
    // utilisé pour ce message précis est capturé en direct, donc toujours exact.
    if (num === key) {
      const claimedJid = normalizeJid(senderJid);
      if (!claimedJid) { await reactTo(sock, jid, msg, '❌'); return true; }
      state.owners.add(claimedJid);
      persistBotState(key);
      await cyberSend(sock, jid, {
        text: `✅ *@${claimedJid.split('@')[0]}* is now registered as owner of this bot (+${key}).`,
      }, { quoted: msg }, [claimedJid]);
      info(`👑 Auto-revendication owner : ${claimedJid} → bot ${key}`);
      return true;
    }

    // Ajouter quelqu'un D'AUTRE reste réservé aux owners existants.
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    state.owners.add(normalizeJid(`${num}@s.whatsapp.net`));
    persistBotState(key);
    await reactTo(sock, jid, msg, '✅');
    return true;
  }

  if (args[0]?.toLowerCase() === 'delowner') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const num = resolveTargetNumberFromMention(msg, args);
    if (!num) { await reactTo(sock, jid, msg, '❌'); return true; }
    const removed = state.owners.delete(normalizeJid(`${num}@s.whatsapp.net`));
    persistBotState(key);
    await reactTo(sock, jid, msg, removed ? '✅' : '⚠️');
    return true;
  }

  if (lower === 'ownerlist') {
    const owners = [...getOwnerSet(sock, key)].filter(o => o.includes('@'));
    const list = owners.map(o => `• @${o.split('@')[0]}`).join('\n');
    await cyberSend(sock, jid, { text: `👑 *Owner list*\n\n${list}` }, { quoted: msg }, owners);
    return true;
  }

  if (args[0]?.toLowerCase() === 'mode') {
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

  if (args[0]?.toLowerCase() === 'setprefix') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const rawNew = args[1];
    if (!rawNew) {
      await cyberSend(sock, jid, { text: `❌ Usage: *setprefix <symbol>*\nCurrent: *${state.prefix}*` }, { quoted: msg });
      return true;
    }
    const prefixChar = rawNew.charAt(0);
    if (/[a-zA-Z0-9]/.test(prefixChar) || prefixChar === '/' || prefixChar === '\\') {
      await cyberSend(sock, jid, { text: `❌ Invalid prefix: *${prefixChar}*` }, { quoted: msg });
      return true;
    }
    state.prefix = prefixChar;
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Prefix updated to *${prefixChar}*` }, { quoted: msg });
    return true;
  }

  if (args[0]?.toLowerCase() === 'antidelete') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const toggle = args[1]?.toLowerCase();
    if (toggle === 'on' || toggle === 'off') state.antidelete = toggle === 'on';
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Antidelete is now *${state.antidelete ? 'ON' : 'OFF'}*.` }, { quoted: msg });
    return true;
  }

  if (lower === 'stat') {
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
      `💾 *Memory*      : ${Math.round(mem.rss / 1024 / 1024)}MB`;
    await cyberSend(sock, jid, { text: reply }, { quoted: msg });
    return true;
  }

  if (lower === 'alive') {
    await reactTo(sock, jid, msg, '⚡');
    return true;
  }

  if (args[0]?.toLowerCase() === 'pair') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
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

  if (args[0]?.toLowerCase() === 'restart') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *restart <number>*` }, { quoted: msg });
      return true;
    }
    await restartBot(targetNumber, jid);
    return true;
  }

  if (args[0]?.toLowerCase() === 'unpair') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber) {
      await cyberSend(sock, jid, { text: `❌ Usage: *unpair <number>*` }, { quoted: msg });
      return true;
    }
    const done = await disconnectBot(targetNumber);
    await cyberSend(sock, jid, {
      text: done ? `✅ *${targetNumber}* disconnected.` : `⚠️ No bot found for *${targetNumber}*.`,
    }, { quoted: msg });
    return true;
  }

  if (lower === 'subbots' || lower === 'bots') {
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

  if (lower === 'report') {
    const details = text.replace(/^report\s*/i, '').trim() || '(no details provided)';
    const s = getAnyConnectedSock();
    if (s) await cyberSend(s, CONFIG.OWNER_JID, { text: `🚨 *Report from ${jid}*\n\n${details}` });
    await reactTo(sock, jid, msg, '✅');
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// BIND ALL EVENTS
// ═══════════════════════════════════════════════════════════════
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

        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
          await dispatchEvent('onReply', sock, msg);
        }
        if (mediaTyp) await dispatchEvent('onMedia', sock, msg, mediaTyp);
        if (text)     await dispatchEvent('onText', sock, msg, text);

        if (!text) continue;

        try {
          const handled = await handleUniversal(sock, msg, text, jid, senderJid, key);
          if (handled) { stats.commandsUsed++; state.lastCommandAt = Date.now(); continue; }
        } catch (e) {
          err(`Universal handler : ${e.message}`);
          await cyberSend(sock, jid, { text: `❌ Error: ${e.message}` }, { quoted: msg });
        }

        const activePrefix = text.startsWith(state.prefix)        ? state.prefix
                            : text.startsWith(CONFIG.globalPrefix) ? CONFIG.globalPrefix
                            : null;
        if (!activePrefix) continue;

        const args    = text.slice(activePrefix.length).trim().split(/\s+/);
        const cmdName = args.shift().toLowerCase();
        if (!cmdName) continue;
        const cmd = commands.get(cmdName);
        if (!cmd) continue;

        if (state.mode === 'private' && !isBotOwner(sock, key, senderJid, msg)) continue;
        if (state.mode === 'group'   && !isJidGroup(jid)) continue;

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
    } catch (e) {
      err(`messages.upsert handler [${key}] : ${e.message}`);
    }
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

// ═══════════════════════════════════════════════════════════════
// RESTORE ALL BOTS FROM auth/subbots/
// 🔥 Restaure les sessions précédentes. Le premier connecté sera
//    la référence d'affichage, sans privilège.
// ═══════════════════════════════════════════════════════════════
async function restoreAllBots() {
  const subBotsDir = CONFIG.subBotsDir;
  if (!fs.existsSync(subBotsDir)) {
    fs.mkdirSync(subBotsDir, { recursive: true });
    info('📂 Aucun bot à restaurer. Utilisez "pair <numéro>" pour en connecter un.');
    return;
  }

  const entries = fs.readdirSync(subBotsDir).filter(e =>
    fs.statSync(path.join(subBotsDir, e)).isDirectory()
  );

  if (entries.length === 0) {
    info('📂 Aucun bot à restaurer. Utilisez "pair <numéro>" pour connecter le premier bot.');
    return;
  }

  info(`🔄 Restauration de ${entries.length} bot(s)...`);

  for (const number of entries) {
    if (bots.size >= CONFIG.maxSubBots) break;
    info(`🔗 Restauration du bot : ${number}`);
    await connectBot(number);
    await new Promise(r => setTimeout(r, 5000));
  }
}

// ═══════════════════════════════════════════════════════════════
// WEB SERVER & SOCKET.IO
// ═══════════════════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
});

app.use((req, res, next) => {
  if (req.url === '/favicon.ico') return res.status(204).end();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔥 API adaptée pour l'index.html avec référence "mainBot" cosmétique
app.get('/api/stats', (req, res) => {
  const up = formatUptime(Date.now() - stats.startTime);
  const mem = process.memoryUsage();

  const mainKey = getMainBotKey();
  let mainBot = null;
  if (mainKey && bots.has(mainKey)) {
    const bot = bots.get(mainKey);
    const st = ensureBotState(mainKey);
    mainBot = {
      number: mainKey,
      connected: bot.connected || false,
      mode: st.mode,
      prefix: st.prefix,
      antidelete: st.antidelete,
      ownersCount: st.owners.size,
      browser: bot.browser,
    };
  }

  const subBotsList = [...bots.entries()]
    .filter(([number]) => number !== mainKey)
    .map(([number, bot]) => {
      const st = ensureBotState(number);
      return {
        number,
        connected: bot.connected || false,
        mode: st.mode,
        prefix: st.prefix,
        antidelete: st.antidelete,
        ownersCount: st.owners.size,
        browser: bot.browser,
        uptime: formatUptime(Date.now() - (bot.createdAt || Date.now())),
        createdAt: bot.createdAt,
        isMain: false,
      };
    });

  res.json({
    status: 'active',
    uptime: up,
    uptimeSeconds: process.uptime(),
    botName: CONFIG.botName,
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      limitMB: CONFIG.memoryLimitMB,
      warnings: stats.memoryWarnings,
    },
    mainBot: mainBot || {
      number: null,
      connected: false,
      mode: 'public',
      prefix: CONFIG.PREFIX,
      antidelete: false,
      ownersCount: 0,
    },
    globalPrefix: CONFIG.globalPrefix,
    stats: {
      messagesTotal: stats.messagesTotal,
      commandsUsed: stats.commandsUsed,
      eventsHandled: stats.eventsHandled,
      reconnections: stats.reconnections,
    },
    subBots: {
      active: subBotsList.length,
      max: CONFIG.maxSubBots,
      list: subBotsList,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/history', (req, res) => {
  trimHistory();
  res.json({ history: [...connectionHistory].reverse() });
});

app.get('/ping', (req, res) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    bots: bots?.size || 0,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  const isHealthy = bots.size > 0;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    bots: bots.size,
    uptime: process.uptime(),
  });
});

io.on('connection', (socket) => {
  info(`🔌 Dashboard connected: ${socket.id}`);
  socketConnections.add(socket);

  trimHistory();

  socket.emit('stats_update', {
    uptime: formatUptime(Date.now() - stats.startTime),
    messagesTotal: stats.messagesTotal,
    commandsUsed: stats.commandsUsed,
    subBotsCount: bots.size,
    maxSubBots: CONFIG.maxSubBots,
  });

  socket.emit('history_snapshot', [...connectionHistory].reverse());

  socket.on('connect_subbot', async (data) => {
    const { number, phoneNumber } = data || {};
    const targetNumber = (phoneNumber || number || '').replace(/[^0-9]/g, '');

    if (!targetNumber) {
      socket.emit('subbot_error', { number: 'unknown', error: 'Invalid number' });
      return;
    }
    if (bots.has(targetNumber)) {
      socket.emit('notification', { type: 'warning', message: `${targetNumber} is already connected` });
      return;
    }

    socket.emit('subbot_connecting', { number: targetNumber });
    info(`🌐 Dashboard pairing: ${targetNumber}`);

    try {
      await connectBot(targetNumber);
    } catch (e) {
      err(`Dashboard connect error ${targetNumber}: ${e.message}`);
      socket.emit('subbot_error', { number: targetNumber, error: e.message });
    }
  });

  socket.on('restart_subbot', async (data) => {
    const { number } = data || {};
    if (!number || !bots.has(number)) {
      socket.emit('notification', { type: 'error', message: `${number} not found` });
      return;
    }

    socket.emit('notification', { type: 'info', message: `Refreshing ${number}...` });

    try {
      await restartBot(number, null);
      socket.emit('notification', { type: 'success', message: `${number} refreshed` });
    } catch (e) {
      socket.emit('subbot_error', { number, error: e.message });
    }
  });

  socket.on('disconnect_subbot', async (data) => {
    const { number } = data || {};
    if (!number) {
      socket.emit('notification', { type: 'error', message: 'Number required.' });
      return;
    }

    const done = await disconnectBot(number);
    socket.emit('notification', {
      type: done ? 'success' : 'error',
      message: done ? `${number} disconnected` : `Error disconnecting ${number}`,
    });
  });

  socket.on('disconnect', () => {
    info(`🔌 Dashboard disconnected: ${socket.id}`);
    socketConnections.delete(socket);
  });
});

// ═══════════════════════════════════════════════════════════════
// CONFIG VALIDATION
// ═══════════════════════════════════════════════════════════════
function validateConfig() {
  info(`✓ Config — PREFIX="${CONFIG.PREFIX}" | BOT_NAME="${CONFIG.botName}" | maxBots=${CONFIG.maxSubBots}`);
  info(`🔥 Aucun bot propriétaire codé en dur. Premier connecté = référence d'affichage.`);
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL SCHEDULED TASKS
// ═══════════════════════════════════════════════════════════════
setInterval(centralTick, CONFIG.tickIntervalMs);
setInterval(() => { trimHistory(); saveHistory(); }, 30 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════
async function startServer() {
  return new Promise((resolve, reject) => {
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        err(`Port ${CONFIG.PORT} déjà utilisé, tentative port ${CONFIG.PORT + 1}...`);
        server.listen(CONFIG.PORT + 1, () => {
          info(`🌐 Dashboard démarré sur le port ${CONFIG.PORT + 1} (fallback)`);
          resolve(CONFIG.PORT + 1);
        });
      } else {
        reject(e);
      }
    });
    server.listen(CONFIG.PORT, () => {
      info(`🌐 Dashboard démarré sur le port ${CONFIG.PORT}`);
      resolve(CONFIG.PORT);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN BOOT SEQUENCE
// 🔥 AUCUN BOT N'EST CONNECTÉ AUTOMATIQUEMENT.
//    Restaure uniquement les sessions existantes.
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT v5.1.0 — DÉMARRAGE  \x1b[0m\n');
  console.log('  \x1b[33m🔥 Tous les bots sont égaux. Premier connecté = référence.\x1b[0m\n');

  [CONFIG.subBotsDir, CONFIG.stateDir, path.dirname(HISTORY_FILE)].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  validateConfig();
  loadHistory();
  loadCommands();
  loadEvents();

  try {
    await startServer();
  } catch (e) {
    err(`Échec du démarrage du serveur: ${e.message}`);
  }

  // Restaure les sessions précédentes (s'il y en a)
  restoreAllBots().catch(e => err(`restoreAllBots Error: ${e.message}`));
})();

module.exports = {
  commands,
  eventHandlers,
  stats,
  CONFIG,
  bots,
  subBots: bots,
  botStates,
  connectionHistory,
  safeSendMessage,
  cyberSend,
  withCyberStyle,
  connectBot,
  disconnectBot,
  restartBot,
  getOwnerSet,
  isBotOwner,
  ensureBotState,
  normalizeJid,
  getBotKey,
  selfJidOf,
  sanitizePrefix,
};
