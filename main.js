'use strict';
// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — main.js (CommonJS)                ║
// ║     Session Permanente · Pair Code · Baileys v7 · Render      ║
// ║  Owners dynamiques · Modes · Sous-bots autonomes · Dashboard  ║
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

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────
const CONFIG = {
  ownerNumber : process.env.OWNER_NUMBER || '584265508074',
  OWNER_JID   : (process.env.OWNER_NUMBER || '584265508074') + '@s.whatsapp.net',
  OWNER_LID   : process.env.OWNER_LID || '83022472810538@lid',
  PREFIX      : process.env.PREFIX || '.',
  globalPrefix: process.env.GLOBAL_PREFIX || '•',
  sessionDir  : './session',
  subBotsDir  : './session/subbots',
  stateDir    : './data/states',
  commandsDir : './commands',
  eventsDir   : './events',
  maxRetries  : 10,
  keepAliveMs           : 10 * 60 * 1000,
  softRestartMs         : 60 * 60 * 1000,
  inactivityLimitMs      : 30 * 60 * 1000,
  disableDurationMs      : 3 * 60 * 1000,
  connectMessageDelayMs   : 120 * 1000,
  historyMaxAgeMs        : 7 * 24 * 60 * 60 * 1000, // 7 jours
  tickIntervalMs         : 60 * 1000, // horloge centrale unique
  botName     : process.env.BOT_NAME || '𝐙𝐞𝐧𝐢𝐭𝐬𝐮 𝐌𝐢𝐧𝐢 𝐕4.0.2',
  maxSubBots  : 20,
  cooldownMinutes: 3,
  groupsToJoin: [
    'https://chat.whatsapp.com/I1oS9uvt89YKTt0zAtZ0Dw',
    'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
    'https://chat.whatsapp.com/KMJOg2l5jLG6VoeBEoBUpO',
  ],
};

// ──────────────────────────────────────────────
//  BROWSERS (fingerprint aléatoire)
// ──────────────────────────────────────────────
const BROWSERS = [
  ['Linux', 'Chrome', '147.0.7727.137'],
  ['Linux', 'Chrome', '146.0.7708.124'],
  ['Linux', 'Chromium', '147.0.7727.137'],
  ['Linux', 'Firefox', '143.0'],
  ['Linux', 'Firefox', '142.0.1'],
  ['Linux', 'Edge', '147.0.3405.102'],
  ['Linux', 'Opera', '123.0.5678.91'],
  ['Linux', 'Brave', '1.83.120'],
  ['Linux', 'Vivaldi', '7.6.3799.48'],
  ['Windows', 'Chrome', '147.0.7727.137'],
  ['Windows', 'Edge', '147.0.3405.102'],
  ['Windows', 'Firefox', '143.0'],
  ['Windows', 'Opera', '123.0.5678.91'],
  ['Windows', 'Brave', '1.83.120'],
  ['Windows', 'Vivaldi', '7.6.3799.48'],
  ['Mac', 'Chrome', '147.0.7727.137'],
  ['Mac', 'Firefox', '143.0'],
  ['Mac', 'Edge', '147.0.3405.102'],
  ['Mac', 'Opera', '123.0.5678.91'],
  ['Mac', 'Brave', '1.83.120'],
  ['Mac', 'Vivaldi', '7.6.3799.48'],
];
const getRandomBrowser = () => BROWSERS[Math.floor(Math.random() * BROWSERS.length)];

// ──────────────────────────────────────────────
//  STATS GLOBALES
// ──────────────────────────────────────────────
const stats = {
  startTime     : Date.now(),
  messagesTotal : 0,
  commandsUsed  : 0,
  eventsHandled : 0,
  reconnections : 0,
};

// ──────────────────────────────────────────────
//  LOGGER
// ──────────────────────────────────────────────
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

async function safeSendMessage(sock, jid, content, opts = {}) {
  if (!sock) return null;
  try {
    return await sock.sendMessage(jid, content, opts);
  } catch (e) {
    err(`safeSendMessage → ${jid} : ${e.message}`);
    return null;
  }
}

// ──────────────────────────────────────────────
//  STYLE CYBERNOVA
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
//  IDENTITÉ / JIDs
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
//  ÉTAT PAR BOT (owners / mode / prefix / antidelete)
//  Chaque bot (main ou sous-bot) possède un état 100% indépendant,
//  persisté sur disque pour survivre aux redémarrages.
// ──────────────────────────────────────────────
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
    };
    fs.writeFileSync(stateFilePath(key), JSON.stringify(serializable, null, 2));
  } catch (e) {
    warn(`Sauvegarde état [${key}] échouée : ${e.message}`);
  }
}

function loadPersistedState(key) {
  try {
    const file = stateFilePath(key);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw;
  } catch (_) {
    return null;
  }
}

function ensureBotState(key) {
  if (!botStates.has(key)) {
    const persisted = loadPersistedState(key);
    botStates.set(key, {
      prefix: persisted?.prefix || CONFIG.PREFIX,
      mode: persisted?.mode || 'public',
      antidelete: persisted?.antidelete !== undefined ? persisted.antidelete : false,
      owners: new Set(persisted?.owners || []),
      lastCommandAt: Date.now(),
      lastKeepAliveAt: 0,
      lastRestart: Date.now(),
      disabledUntil: 0,
      createdAt: persisted?.createdAt || Date.now(),
      messageCache: new Map(),
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

function getOwnerSet(sock, key) {
  const state = ensureBotState(key);
  const set = new Set();
  set.add(normalizeJid(CONFIG.OWNER_JID));
  if (CONFIG.OWNER_LID) set.add(normalizeJid(CONFIG.OWNER_LID));
  if (sock?.user?.id)  set.add(normalizeJid(sock.user.id));
  if (sock?.user?.lid) set.add(normalizeJid(sock.user.lid));
  for (const o of state.owners) set.add(o);
  return set;
}

function isBotOwner(sock, key, senderJid) {
  return getOwnerSet(sock, key).has(normalizeJid(senderJid));
}

// ──────────────────────────────────────────────
//  COOLDOWN CONNEXION SOUS-BOTS
// ──────────────────────────────────────────────
const connectionCooldowns = new Map();

function isOnCooldown(number) {
  const cooldownMs = CONFIG.cooldownMinutes * 60 * 1000;
  const lastAttempt = connectionCooldowns.get(number) || 0;
  const remaining = (lastAttempt + cooldownMs) - Date.now();
  if (remaining > 0) {
    return { onCooldown: true, remaining: Math.ceil(remaining / 60000) };
  }
  return { onCooldown: false, remaining: 0 };
}

function setCooldown(number) {
  connectionCooldowns.set(number, Date.now());
}

// ──────────────────────────────────────────────
//  ANTI-SPAM MESSAGE DE CONNEXION
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
//  HISTORIQUE DE CONNEXION (PURGE 7 JOURS)
// ──────────────────────────────────────────────
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
let connectionHistory = [];

function purgeOldHistory() {
  const cutoff = Date.now() - CONFIG.historyMaxAgeMs;
  connectionHistory = connectionHistory.filter(entry => {
    const t = new Date(entry.date).getTime();
    return !isNaN(t) && t >= cutoff;
  });
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      connectionHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      purgeOldHistory();
    }
  } catch (_) { connectionHistory = []; }
}

function saveHistory() {
  try {
    purgeOldHistory();
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(connectionHistory.slice(-500), null, 2));
  } catch (e) { warn(`Historique non sauvegardé : ${e.message}`); }
}

function addHistory(entry) {
  const record = { ...entry, date: new Date().toISOString() };
  connectionHistory.push(record);
  purgeOldHistory();
  if (connectionHistory.length > 500) connectionHistory.shift();
  notifyWebInterface('history_update', record);
  saveHistory();
}

// ──────────────────────────────────────────────
//  VÉRIFICATION WHATSAPP
//  Utilise n'importe quel socket connecté disponible (main OU sous-bot),
//  jamais une dépendance obligatoire au Main Bot.
// ──────────────────────────────────────────────
function getAnyConnectedSock(preferred) {
  if (preferred && preferred?.ws?.isOpen !== false && preferred?.user) return preferred;
  if (mainSock?.user) return mainSock;
  for (const bot of subBots.values()) {
    if (bot.connected && bot.sock?.user) return bot.sock;
  }
  return null;
}

async function verifyOnWhatsApp(preferredSock, number) {
  const sock = getAnyConnectedSock(preferredSock);
  if (!sock) return true; // Aucun socket disponible → on ne bloque pas l'utilisateur
  try {
    const [res] = await sock.onWhatsApp(number);
    return res?.exists === true;
  } catch (e) {
    warn(`Vérification onWhatsApp échouée pour ${number} : ${e.message}`);
    return true; // en cas d'erreur réseau, on laisse passer plutôt que bloquer
  }
}

// ──────────────────────────────────────────────
//  CHARGEUR DE COMMANDES
// ──────────────────────────────────────────────
const commands = new Map();

function loadCommands() {
  const dir = path.resolve(CONFIG.commandsDir);
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

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (mod && mod.name && typeof mod.execute === 'function') {
        commands.set(mod.name.toLowerCase(), mod);
        log('CMD', `Chargé : .${mod.name}`);
      } else {
        warn(`commands/${file} : export invalide (name + execute requis).`);
      }
    } catch (e) {
      err(`commands/${file} : ${e.message}`);
    }
  }
  info(`${commands.size} commande(s) chargée(s).`);
}

// ──────────────────────────────────────────────
//  CHARGEUR D'EVENTS
// ──────────────────────────────────────────────
const eventHandlers = new Map();

function loadEvents() {
  const dir = path.resolve(CONFIG.eventsDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    warn(`Dossier ${CONFIG.eventsDir} créé (vide).`);
    return;
  }

  eventHandlers.clear();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (mod && mod.event && typeof mod.execute === 'function') {
        if (!eventHandlers.has(mod.event)) eventHandlers.set(mod.event, []);
        eventHandlers.get(mod.event).push(mod);
        log('EVT', `Chargé : ${mod.event} (${file})`);
      } else {
        warn(`events/${file} : export invalide (event + execute requis).`);
      }
    } catch (e) {
      err(`events/${file} : ${e.message}`);
    }
  }
  info(`${eventHandlers.size} type(s) d'événement(s) chargé(s).`);
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

// ──────────────────────────────────────────────
//  REJOINDRE LES GROUPES
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
//  MESSAGE DE CONNEXION
// ──────────────────────────────────────────────
async function sendSelfConnectedMessage(sock, label, key) {
  try {
    const selfJid = selfJidOf(sock);
    if (!selfJid) return;
    const state = ensureBotState(key);

    setTimeout(async () => {
      if (!shouldSendConnectionMessage(`connmsg:${selfJid}`)) return;
      await cyberSend(sock, selfJid, {
        text:
          `👑 *${CONFIG.botName} — ${label} CONNECTED*\n` +
          `🕒 ${new Date().toLocaleTimeString('en-US')}\n` +
          `📊 ${commands.size} commands loaded\n` +
          `Prefix: ${state.prefix}`,
      }, {}, [normalizeJid(CONFIG.OWNER_JID)]);
    }, CONFIG.connectMessageDelayMs);
  } catch (e) {
    warn(`Message de connexion auto échoué : ${e.message}`);
  }
}

// ══════════════════════════════════════════════
//  GESTION DES SOUS-BOTS (autonomes, aucune dépendance au Main Bot)
// ══════════════════════════════════════════════
const subBots = new Map();
const socketConnections = new Set();
let mainSock = null;

function notifyWebInterface(event, data) {
  for (const socket of socketConnections) {
    try { socket.emit(event, data); } catch (_) {}
  }
}

function softRefreshBot(key, sockRef) {
  const st = ensureBotState(key);
  st.messageCache.clear();
  st.lastRestart = Date.now();
  st.disabledUntil = 0;
  st.lastCommandAt = Date.now();
  if (sockRef) sockRef.sendPresenceUpdate('available').catch(() => {});
  info(`♻️ Soft refresh — ${key} (cache vidé, socket conservé)`);
  addHistory({ type: key === 'main' ? 'main' : 'subbot', number: key, event: 'soft_refresh' });
  notifyWebInterface('bot_refreshed', { number: key });
}

/**
 * Connecte un sous-bot de manière totalement autonome.
 * `requesterSock` (optionnel) sert uniquement à envoyer des messages de statut
 * à la personne qui a demandé la connexion. Si absent (Main Bot éteint),
 * le sous-bot génère quand même son Pair Code et se connecte normalement.
 */
async function connectSubBot(requesterJid, number, requesterSock = null) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const statusSock = () => getAnyConnectedSock(requesterSock);

  if (subBots.size >= CONFIG.maxSubBots) {
    const s = statusSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `❌ Maximum bots reached (${CONFIG.maxSubBots}).` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `Maximum bots limit reached (${CONFIG.maxSubBots})` });
    return;
  }

  if (subBots.has(cleanNumber)) {
    const s = statusSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `⚠️ *${cleanNumber}* is already connected.` });
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `${cleanNumber} is already connected` });
    return;
  }

  const cooldownCheck = isOnCooldown(cleanNumber);
  if (cooldownCheck.onCooldown) {
    const s = statusSock();
    if (s && requesterJid) {
      await cyberSend(s, requesterJid, {
        text: `⏳ *${cleanNumber}* is on cooldown. Please wait ${cooldownCheck.remaining} minute(s) before trying again.`,
      });
    }
    notifyWebInterface('subbot_error', { number: cleanNumber, error: `Cooldown active. Retry in ${cooldownCheck.remaining} min.` });
    return;
  }

  const exists = await verifyOnWhatsApp(requesterSock, cleanNumber);
  if (!exists) {
    setCooldown(cleanNumber);
    const s = statusSock();
    if (s && requesterJid) {
      await cyberSend(s, requesterJid, {
        text: `❌ *${cleanNumber}* is not registered on WhatsApp. Please verify the number.\n⏳ Cooldown: ${CONFIG.cooldownMinutes} minutes.`,
      });
    }
    notifyWebInterface('subbot_error', { number: cleanNumber, error: 'Number not registered on WhatsApp' });
    addHistory({ type: 'subbot', number: cleanNumber, event: 'verification_failed' });
    return;
  }

  {
    const s = statusSock();
    if (s && requesterJid) await cyberSend(s, requesterJid, { text: `🔗 Connecting *${cleanNumber}* ...` });
  }

  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  if (!fs.existsSync(subSessionDir)) fs.mkdirSync(subSessionDir, { recursive: true });

  ensureBotState(cleanNumber);
  setCooldown(cleanNumber);

  let subRetryCount    = 0;
  let subPairRequested = false;

  notifyWebInterface('subbot_connecting', { number: cleanNumber });

  async function _connectSub() {
    const { state, saveCreds } = await useMultiFileAuthState(subSessionDir);
    const { version }          = await fetchLatestBaileysVersion();
    const browser = getRandomBrowser();

    const subSock = makeWASocket({
      version,
      logger,
      auth: {
        creds : state.creds,
        keys  : makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal             : false,
      markOnlineOnConnect           : true,
      syncFullHistory                : false,
      browser,
      generateHighQualityLinkPreview: false,
    });

    subBots.set(cleanNumber, {
      sock: subSock,
      retryCount: subRetryCount,
      connected: false,
      createdAt: subBots.get(cleanNumber)?.createdAt || Date.now(),
      browser: browser.join(' / '),
    });

    subSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      // Le sous-bot génère TOUJOURS son propre Pair Code, indépendamment du Main Bot.
      if (connection === 'connecting' && !subSock.authState.creds.registered && !subPairRequested) {
        subPairRequested = true;
        await new Promise(r => setTimeout(r, 5000));
        try {
          const rawCode   = await subSock.requestPairingCode(cleanNumber);
          const formatted = rawCode.toUpperCase().match(/.{1,4}/g).join('-');

          addHistory({ type: 'subbot', number: cleanNumber, event: 'pairing_code', code: formatted, browser: browser.join(' / ') });
          notifyWebInterface('subbot_qr', { number: cleanNumber, code: formatted });

          const s = statusSock();
          if (s && requesterJid) {
            await cyberSend(s, requesterJid, {
              text:
                `🔑 *PAIRING CODE — ${cleanNumber}*\n\n` +
                `┌─────────────────┐\n` +
                `│   *${formatted}*   │\n` +
                `└─────────────────┘\n\n` +
                `📱 WhatsApp → Linked devices → Link with phone number`,
            });
            await cyberSend(s, requesterJid, { text: `*${formatted}*` }, {}, [normalizeJid(CONFIG.OWNER_JID)]);
          }
        } catch (e) {
          err(`Sub-bot pair code (${cleanNumber}) : ${e.message}`);
          subPairRequested = false;
          notifyWebInterface('subbot_error', { number: cleanNumber, error: e.message });
        }
      }

      if (connection === 'open') {
        subRetryCount    = 0;
        subPairRequested = false;

        info(`✅ Sous-bot connecté : ${cleanNumber}`);
        addHistory({ type: 'subbot', number: cleanNumber, event: 'connected', browser: browser.join(' / ') });

        const stNow = ensureBotState(cleanNumber);
        stNow.lastCommandAt   = Date.now();
        stNow.lastKeepAliveAt = Date.now();
        stNow.lastRestart     = Date.now();
        stNow.disabledUntil   = 0;

        notifyWebInterface('subbot_connected', {
          number: cleanNumber,
          mode: stNow.mode,
          prefix: stNow.prefix,
          antidelete: stNow.antidelete,
          browser: browser.join(' / '),
        });

        subBots.set(cleanNumber, {
          sock: subSock,
          retryCount: subRetryCount,
          connected: true,
          createdAt: subBots.get(cleanNumber)?.createdAt || Date.now(),
          browser: browser.join(' / '),
        });

        await sendSelfConnectedMessage(subSock, `SUB-BOT ${cleanNumber}`, cleanNumber);
        joinBotGroups(subSock).catch(() => {});
        bindAllEvents(subSock, cleanNumber);
      }

      if (connection === 'close') {
        const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
        const wasReg = subSock.authState.creds.registered;

        addHistory({ type: 'subbot', number: cleanNumber, event: 'disconnected', code });
        notifyWebInterface('subbot_disconnected', { number: cleanNumber, code, wasRegistered: wasReg });

        if (code === DisconnectReason.loggedOut && wasReg) {
          warn(`Sous-bot ${cleanNumber} : session expirée.`);
          try { fs.rmSync(subSessionDir, { recursive: true, force: true }); } catch (_) {}
          subBots.delete(cleanNumber);
          deleteBotState(cleanNumber);
          addHistory({ type: 'subbot', number: cleanNumber, event: 'session_expired' });

          const s = statusSock();
          if (s && requesterJid) {
            await cyberSend(s, requesterJid, {
              text: `⚠️ Sub-bot *${cleanNumber}* disconnected (session expired). Retry with "pair ${cleanNumber}".`,
            });
          }
          return;
        }

        if (subRetryCount < CONFIG.maxRetries) {
          subRetryCount++;
          subPairRequested = false;
          const delay = Math.min(1000 * 2 ** subRetryCount, 30000);
          warn(`Sous-bot ${cleanNumber} : reconnexion ${subRetryCount}/${CONFIG.maxRetries} dans ${delay / 1000}s...`);

          notifyWebInterface('subbot_reconnecting', {
            number: cleanNumber,
            attempt: subRetryCount,
            maxRetries: CONFIG.maxRetries,
          });

          setTimeout(_connectSub, delay);
        } else {
          err(`${cleanNumber} : échec après ${CONFIG.maxRetries} tentatives.`);
          try { fs.rmSync(subSessionDir, { recursive: true, force: true }); } catch (_) {}

          subBots.delete(cleanNumber);
          deleteBotState(cleanNumber);
          connectionCooldowns.delete(cleanNumber);
          addHistory({ type: 'subbot', number: cleanNumber, event: 'max_retries_exceeded' });
          notifyWebInterface('subbot_failed', { number: cleanNumber });

          const s = statusSock();
          if (s && requesterJid) {
            await cyberSend(s, requesterJid, { text: `❌ *${cleanNumber}* could not stay connected. Session cleared — you can retry with "pair ${cleanNumber}".` });
          }
        }
      }
    });

    subSock.ev.on('creds.update', saveCreds);
  }

  await _connectSub();
}

// ──────────────────────────────────────────────
//  DISCONNECT / RESTART
// ──────────────────────────────────────────────
async function disconnectSubBot(number) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = subBots.get(cleanNumber);

  if (!bot) return false;

  try {
    await bot.sock.logout();
  } catch (_) {
    try { await bot.sock.end(); } catch (__) {}
  }

  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  try { fs.rmSync(subSessionDir, { recursive: true, force: true }); } catch (_) {}
  subBots.delete(cleanNumber);
  deleteBotState(cleanNumber);
  connectionCooldowns.delete(cleanNumber);
  addHistory({ type: 'subbot', number: cleanNumber, event: 'manual_disconnect' });
  notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'manual' });
  return true;
}

async function restartSubBot(number, requesterJid, requesterSock = null) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = subBots.get(cleanNumber);
  const s = getAnyConnectedSock(requesterSock);

  if (!bot) {
    if (s && requesterJid) {
      await cyberSend(s, requesterJid, { text: `⚠️ No bot found for *${cleanNumber}*. Use "pair ${cleanNumber}".` });
    }
    return false;
  }

  softRefreshBot(cleanNumber, bot.sock);

  if (s && requesterJid) {
    await cyberSend(s, requesterJid, { text: `♻️ *${cleanNumber}* refreshed — cache cleared, connection kept alive.` });
  }

  return true;
}

// ──────────────────────────────────────────────
//  HORLOGE CENTRALE UNIQUE
//  Remplace tous les setInterval individuels (keepalive + soft-restart
//  + anti-inactivité) par un seul tick global — réduit fortement la
//  consommation mémoire/CPU quand le nombre de bots augmente.
// ──────────────────────────────────────────────
function centralTick() {
  const nowTs = Date.now();

  // Main bot
  if (mainSock?.user) {
    const st = ensureBotState('main');
    if (nowTs - st.lastKeepAliveAt >= CONFIG.keepAliveMs) {
      st.lastKeepAliveAt = nowTs;
      mainSock.sendPresenceUpdate('available').catch(() => {});
      info(`⚡ KeepAlive [main] — uptime: ${formatUptime(nowTs - stats.startTime)} | msgs: ${stats.messagesTotal} | cmds: ${stats.commandsUsed} | subbots ${subBots.size}`);
    }
    if (nowTs - st.lastRestart >= CONFIG.softRestartMs) {
      softRefreshBot('main', mainSock);
    }
  }

  // Sous-bots
  for (const [number, bot] of subBots.entries()) {
    if (!bot.connected) continue;
    const st = ensureBotState(number);

    if (nowTs - st.lastKeepAliveAt >= CONFIG.keepAliveMs) {
      st.lastKeepAliveAt = nowTs;
      bot.sock.sendPresenceUpdate('available').catch(() => {});
    }

    if (nowTs - st.lastRestart >= CONFIG.softRestartMs) {
      softRefreshBot(number, bot.sock);
    }

    // Anti-inactivité
    if (st.disabledUntil && nowTs >= st.disabledUntil) {
      st.disabledUntil = 0;
      st.lastCommandAt = nowTs;
      notifyWebInterface('subbot_reactivated', { number });
      continue;
    }
    if (st.disabledUntil) continue;

    if (nowTs - st.lastCommandAt >= CONFIG.inactivityLimitMs) {
      st.disabledUntil = nowTs + CONFIG.disableDurationMs;
      notifyWebInterface('subbot_idle_disabled', { number, minutes: Math.round(CONFIG.disableDurationMs / 60000) });
      addHistory({ type: 'subbot', number, event: 'idle_disabled' });

      const target = selfJidOf(bot.sock);
      if (target) {
        cyberSend(bot.sock, target, {
          text: `⏸️ *Idle pause*\nNo command received recently — pausing briefly to keep the system smooth.`,
        }).catch(() => {});
      }
    }
  }
}

// ──────────────────────────────────────────────
//  COMMANDES UNIVERSELLES (owner / config / sous-bots)
//  Fonctionnent identiquement sur le Main Bot et sur tout Sous-bot,
//  chacun avec son propre état indépendant (owners/mode/prefix/antidelete).
// ──────────────────────────────────────────────
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
  const ownerOk = () => isBotOwner(sock, key, senderJid);

  if (args[0]?.toLowerCase() === 'addowner') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const num = resolveTargetNumberFromMention(msg, args);
    if (!num) { await reactTo(sock, jid, msg, '❌'); return true; }
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
    const newPrefix = args[1];
    if (!newPrefix || newPrefix.length > 3) {
      await cyberSend(sock, jid, { text: `❌ Usage: *setprefix <symbol>*\nCurrent: *${state.prefix}*` }, { quoted: msg });
      return true;
    }
    state.prefix = newPrefix;
    persistBotState(key);
    await cyberSend(sock, jid, { text: `✅ Prefix set to *${newPrefix}*.` }, { quoted: msg });
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
    const reply =
      `╔═════════════════╗\n║   📊 *${CONFIG.botName}*   ║\n╚═════════════════╝\n` +
      `⏱ *Uptime*      : ${up}\n💬 *Messages*    : ${stats.messagesTotal}\n` +
      `⚡ *Commands*    : ${stats.commandsUsed}\n🎯 *Events*      : ${stats.eventsHandled}\n` +
      `🔄 *Reconnects*  : ${stats.reconnections}\n🤖 *Sub-bots*    : ${subBots.size}/${CONFIG.maxSubBots}\n` +
      `🧩 *Mode*        : ${state.mode}\n🔡 *Prefix*      : ${state.prefix}`;
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
    if (subBots.size >= CONFIG.maxSubBots) {
      await cyberSend(sock, jid, { text: `❌ Limit reached: ${CONFIG.maxSubBots} sub-bots max.\nActive: ${[...subBots.keys()].join(', ')}` }, { quoted: msg });
      return true;
    }
    connectSubBot(jid, targetNumber, sock).catch(e => err(`connectSubBot : ${e.message}`));
    return true;
  }

  if (args[0]?.toLowerCase() === 'restart') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *restart <number>*` }, { quoted: msg });
      return true;
    }
    await restartSubBot(targetNumber, jid, sock);
    return true;
  }

  if (args[0]?.toLowerCase() === 'unpair') {
    if (!ownerOk()) { await reactTo(sock, jid, msg, '🚫'); return true; }
    const targetNumber = args[1];
    if (!targetNumber) {
      await cyberSend(sock, jid, { text: `❌ Usage: *unpair <number>*` }, { quoted: msg });
      return true;
    }
    const done = await disconnectSubBot(targetNumber);
    await cyberSend(sock, jid, {
      text: done ? `✅ *${targetNumber}* disconnected.` : `⚠️ No bot found for *${targetNumber}*.`,
    }, { quoted: msg });
    return true;
  }

  if (lower === 'subbots') {
    if (subBots.size === 0) {
      await cyberSend(sock, jid, { text: `🤖 No active sub-bots.` }, { quoted: msg });
    } else {
      const list = [...subBots.entries()].map(([n, bot], i) => {
        const st2 = ensureBotState(n);
        const paused = st2.disabledUntil && Date.now() < st2.disabledUntil;
        const status = bot.connected ? (paused ? '⏸️' : '🟢') : '🟡';
        return `${i + 1}. ${status} +${n} — mode:${st2.mode} prefix:${st2.prefix} (up ${formatUptime(Date.now() - bot.createdAt)})`;
      }).join('\n');
      await cyberSend(sock, jid, { text: `🤖 *Active sub-bots (${subBots.size}/${CONFIG.maxSubBots})*\n\n${list}` }, { quoted: msg });
    }
    return true;
  }

  if (lower === 'report') {
    const details = text.replace(/^report\s*/i, '').trim() || '(no details provided)';
    const s = getAnyConnectedSock(sock);
    if (s) await cyberSend(s, CONFIG.OWNER_JID, { text: `🚨 *Report from ${jid}*\n\n${details}` });
    await reactTo(sock, jid, msg, '✅');
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────
//  PAIR CODE (BOT PRINCIPAL)
// ──────────────────────────────────────────────
let pairCodeRequested = false;

async function requestPairCode(sock) {
  if (pairCodeRequested) return;
  pairCodeRequested = true;
  const number = CONFIG.ownerNumber.replace(/[^0-9]/g, '');
  await new Promise(r => setTimeout(r, 5000));
  try {
    const rawCode   = await sock.requestPairingCode(number);
    const formatted = rawCode.toUpperCase().match(/.{1,4}/g).join('-');
    console.log('\n');
    console.log('  \x1b[42m\x1b[30m  PAIRING CODE MAIN BOT \x1b[0m');
    console.log(`  \x1b[1m\x1b[33m   ${formatted}   \x1b[0m`);
    console.log('  WhatsApp → Linked Devices → Link with pairing code\n');

    addHistory({ type: 'main', number, event: 'pairing_code', code: formatted });
    notifyWebInterface('main_qr', { code: formatted });
  } catch (e) {
    err(`Impossible d'obtenir le pair code principal : ${e.message}`);
    pairCodeRequested = false;
  }
}

// ──────────────────────────────────────────────
//  BIND DE TOUS LES EVENTS
// ──────────────────────────────────────────────
function bindAllEvents(sock, key) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    await dispatchEvent('messages.upsert', sock, { messages, type });

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;

      stats.messagesTotal++;

      const jid       = msg.key.remoteJid;
      const senderJid = getSenderJid(msg, sock);
      const isMainBot = key === 'main';
      const state      = ensureBotState(key);
      const text       = extractText(msg).trim();
      const mediaTyp   = getMediaType(msg);

      if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        await dispatchEvent('onReply', sock, msg);
      }
      if (mediaTyp) await dispatchEvent('onMedia', sock, msg, mediaTyp);
      if (text)     await dispatchEvent('onText', sock, msg, text);

      if (!text) continue;
      if (!isMainBot && state.disabledUntil && Date.now() < state.disabledUntil) continue;

      // Commandes universelles (owner/config/sous-bots) — indépendantes du prefix
      try {
        const handled = await handleUniversal(sock, msg, text, jid, senderJid, key);
        if (handled) { stats.commandsUsed++; state.lastCommandAt = Date.now(); continue; }
      } catch (e) {
        err(`Universal handler : ${e.message}`);
        await cyberSend(sock, jid, { text: `❌ Error: ${e.message}` }, { quoted: msg });
      }

      // Commandes préfixées (chargées depuis /commands)
      const activePrefix = text.startsWith(state.prefix)        ? state.prefix
                          : text.startsWith(CONFIG.globalPrefix) ? CONFIG.globalPrefix
                          : null;
      if (!activePrefix) continue;

      const args    = text.slice(activePrefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();
      if (!cmdName) continue;
      const cmd = commands.get(cmdName);
      if (!cmd) continue;

      // Vérification du mode — logique claire et déterministe
      if (state.mode === 'private' && !isBotOwner(sock, key, senderJid)) continue;
      if (state.mode === 'group'   && !isJidGroup(jid)) continue;
      // mode 'public' : aucune restriction

      log('CMD', `[${key}] ${jid} → ${activePrefix}${cmdName} [${args.join(', ')}]`);
      stats.commandsUsed++;
      state.lastCommandAt = Date.now();

      try {
        await cmd.execute({
          sock, msg, args, jid, senderJid, text,
          config: CONFIG, stats, subBots,
          botKey: key, botState: state,
          isBotOwner: () => isBotOwner(sock, key, senderJid),
        });
      } catch (e) {
        err(`Commande [${cmdName}] : ${e.message}`);
        await cyberSend(sock, jid, { text: `❌ Command *${cmdName}* error:\n${e.message}` }, { quoted: msg });
      }
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
  sock.ev.on('newsletters',               (u) => dispatchEvent('newsletters',                sock, u));
}

// ──────────────────────────────────────────────
//  CONNEXION PRINCIPALE
//  Le Main Bot est maintenant un bot "comme les autres" : son
//  indisponibilité n'affecte plus le fonctionnement des sous-bots.
// ──────────────────────────────────────────────
let retryCount = 0;

async function connectMainBot() {
  [CONFIG.sessionDir, CONFIG.subBotsDir, CONFIG.stateDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir);
    const { version }          = await fetchLatestBaileysVersion();
    const browser = getRandomBrowser();

    info(`Baileys version : ${version.join('.')} | Browser: ${browser.join(' / ')}`);

    mainSock = makeWASocket({
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
    });

    mainSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting' && !mainSock.authState.creds.registered) {
        requestPairCode(mainSock);
      }

      if (connection === 'open') {
        retryCount        = 0;
        pairCodeRequested = false;
        info(`✅ Connecté en tant que ${mainSock.user?.id}`);

        const st = ensureBotState('main');
        st.lastCommandAt   = Date.now();
        st.lastKeepAliveAt = Date.now();
        st.lastRestart     = Date.now();
        st.disabledUntil   = 0;

        addHistory({ type: 'main', number: CONFIG.ownerNumber, event: 'connected', browser: browser.join(' / ') });

        await sendSelfConnectedMessage(mainSock, 'MAIN BOT', 'main');

        setTimeout(() => joinBotGroups(mainSock), 10000);
        await dispatchEvent('connection.open', mainSock);
        notifyWebInterface('main_connected', { jid: mainSock.user?.id });
      }

      if (connection === 'close') {
        const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
        const wasReg = mainSock?.authState?.creds?.registered;

        warn(`Connexion fermée (Main Bot) — code: ${code}`);
        addHistory({ type: 'main', number: CONFIG.ownerNumber, event: 'disconnected', code });
        notifyWebInterface('main_disconnected', { code, wasRegistered: wasReg });

        if (code === DisconnectReason.loggedOut && wasReg) {
          err('Session expirée. Suppression et redémarrage...');
          fs.rmSync(CONFIG.sessionDir, { recursive: true, force: true });
          pairCodeRequested = false;
          retryCount        = 0;
          return connectMainBot();
        }

        if (retryCount < CONFIG.maxRetries) {
          retryCount++;
          stats.reconnections++;
          pairCodeRequested = false;
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          warn(`Reconnexion main bot ${retryCount}/${CONFIG.maxRetries} dans ${delay / 1000}s...`);
          setTimeout(connectMainBot, delay);
        } else {
          err(`Échec du Main Bot après ${CONFIG.maxRetries} tentatives. Les sous-bots et le serveur web continuent de fonctionner normalement.`);
        }
      }

      if (connection === 'connecting') {
        info('Connexion main bot en cours...');
      }

      await dispatchEvent('connection.update', mainSock, update);
    });

    mainSock.ev.on('creds.update', saveCreds);
    bindAllEvents(mainSock, 'main');

  } catch (e) {
    err(`Erreur de connexion du Main Bot : ${e.message}`);
  }
}

// ──────────────────────────────────────────────
//  RESTAURATION DES SOUS-BOTS
//  Entièrement indépendante du Main Bot : chaque sous-bot restaure
//  sa propre session même si mainSock est null / hors ligne.
// ──────────────────────────────────────────────
async function restoreSubBots() {
  if (!fs.existsSync(CONFIG.subBotsDir)) return;
  const entries = fs.readdirSync(CONFIG.subBotsDir).filter(e =>
    fs.statSync(path.join(CONFIG.subBotsDir, e)).isDirectory()
  );
  for (const number of entries) {
    if (subBots.size >= CONFIG.maxSubBots) break;
    info(`Restauration du sous-bot : ${number}`);
    await connectSubBot(CONFIG.OWNER_JID, number, null);
    await new Promise(r => setTimeout(r, 5000));
  }
}

process.on('uncaughtException',  (e) => err(`uncaughtException : ${e.message}\n${e.stack}`));
process.on('unhandledRejection', (e) => err(`unhandledRejection : ${e}`));

// ══════════════════════════════════════════════
//  SERVEUR WEB & SOCKET.IO (Lancement direct pour Render)
// ══════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/stats', (req, res) => {
  const up = formatUptime(Date.now() - stats.startTime);
  const subBotsList = [...subBots.entries()].map(([number, bot]) => {
    const st = ensureBotState(number);
    return {
      number,
      connected: bot.connected || false,
      paused: !!(st.disabledUntil && Date.now() < st.disabledUntil),
      mode: st.mode,
      prefix: st.prefix,
      antidelete: st.antidelete,
      ownersCount: st.owners.size,
      browser: bot.browser,
      uptime: formatUptime(Date.now() - (bot.createdAt || Date.now())),
      createdAt: bot.createdAt,
    };
  });

  const mainState = ensureBotState('main');

  res.json({
    status: 'active',
    uptime: up,
    uptimeSeconds: process.uptime(),
    botName: CONFIG.botName,
    mainBot: {
      number: CONFIG.ownerNumber,
      connected: mainSock?.user ? (mainSock?.ws?.isOpen ?? true) : false,
      mode: mainState.mode,
      prefix: mainState.prefix,
      antidelete: mainState.antidelete,
      ownersCount: mainState.owners.size,
    },
    globalPrefix: CONFIG.globalPrefix,
    stats: {
      messagesTotal: stats.messagesTotal,
      commandsUsed: stats.commandsUsed,
      eventsHandled: stats.eventsHandled,
      reconnections: stats.reconnections,
    },
    subBots: {
      active: subBots.size,
      max: CONFIG.maxSubBots,
      list: subBotsList,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/history', (req, res) => {
  purgeOldHistory();
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  res.json({ history: connectionHistory.slice(-limit).reverse() });
});

app.get('/ping', (req, res) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    subBots: subBots?.size || 0,
    timestamp: new Date().toISOString(),
  });
});

io.on('connection', (socket) => {
  info(`🔌 Web user connected: ${socket.id}`);
  socketConnections.add(socket);

  purgeOldHistory();

  socket.emit('stats_update', {
    uptime: formatUptime(Date.now() - stats.startTime),
    messagesTotal: stats.messagesTotal,
    commandsUsed: stats.commandsUsed,
    subBotsCount: subBots.size,
    maxSubBots: CONFIG.maxSubBots,
  });

  socket.emit('history_snapshot', connectionHistory.slice(-100).reverse());

  socket.on('connect_subbot', async (data) => {
    const { number, phoneNumber } = data || {};
    const targetNumber = phoneNumber || number;

    if (!targetNumber) {
      socket.emit('subbot_error', { number: 'unknown', error: 'Invalid number' });
      return;
    }
    if (subBots.has(targetNumber)) {
      socket.emit('notification', { type: 'warning', message: `${targetNumber} is already connected` });
      return;
    }

    socket.emit('subbot_connecting', { number: targetNumber });
    info(`🌐 Connexion sub-bot Web : ${targetNumber}`);

    try {
      // Aucune dépendance au Main Bot : le sous-bot se connecte seul.
      await connectSubBot(CONFIG.OWNER_JID, targetNumber, null);
    } catch (e) {
      err(`Erreur connexion web sous-bot ${targetNumber}: ${e.message}`);
      socket.emit('subbot_error', { number: targetNumber, error: e.message });
    }
  });

  socket.on('restart_subbot', async (data) => {
    const { number } = data || {};
    if (!number || !subBots.has(number)) {
      socket.emit('notification', { type: 'error', message: `${number} not found` });
      return;
    }

    socket.emit('notification', { type: 'info', message: `Refreshing (${number}) — cache clear...` });

    try {
      await restartSubBot(number, CONFIG.OWNER_JID, null);
      socket.emit('notification', { type: 'success', message: `${number} successfully refreshed` });
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

    const done = await disconnectSubBot(number);
    socket.emit('notification', {
      type: done ? 'success' : 'error',
      message: done ? `${number} disconnected` : `Error while disconnecting ${number}`,
    });
  });

  socket.on('disconnect', () => {
    info(`🔌 Web client disconnected: ${socket.id}`);
    socketConnections.delete(socket);
  });
});

// ──────────────────────────────────────────────
//  TÂCHES PLANIFIÉES GLOBALES
//  (Self-ping supprimé — Render garde le service actif via le trafic
//  entrant normal ; aucune requête HTTP interne n'est nécessaire.)
// ──────────────────────────────────────────────
setInterval(centralTick, CONFIG.tickIntervalMs);
setInterval(() => { purgeOldHistory(); saveHistory(); }, 24 * 60 * 60 * 1000);

// DÉMARRAGE DU SERVEUR
server.listen(PORT, async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT PRO — DÉMARRAGE  \x1b[0m\n');
  info(`🌐 Interface Web Pro démarrée sur le port ${PORT}`);
  info(`📊 Dashboard: http://localhost:${PORT}`);

  loadHistory();
  loadCommands();
  loadEvents();

  // Connexion du Main Bot — non bloquante, purement optionnelle.
  connectMainBot().catch(e => err(`Boot Main Bot Error: ${e.message}`));

  // Restauration des sous-bots — totalement indépendante du Main Bot.
  setTimeout(() => restoreSubBots().catch(e => err(`restoreSubBots Error: ${e.message}`)), 10000);
});

module.exports = {
  commands,
  eventHandlers,
  stats,
  CONFIG,
  subBots,
  botStates,
  connectionHistory,
  safeSendMessage,
  cyberSend,
  withCyberStyle,
  connectSubBot,
  disconnectSubBot,
  restartSubBot,
  getOwnerSet,
  isBotOwner,
  ensureBotState,
  normalizeJid,
  getBotKey,
  selfJidOf,
};
