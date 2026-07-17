

'use strict';

// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — main.js (CommonJS)               ║
// ║     Session Permanente · Pair Code · Baileys · Render       ║
// ║   Owners dynamiques · Modes · Anti-inactivité · Soft-restart║
// ╚══════════════════════════════════════════════════════════════╝

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  isJidGroup,
  proto,
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
  ownerNumber : process.env.OWNER_NUMBER || '5491125778333',
  OWNER_JID   : (process.env.OWNER_NUMBER || '5491125778333') + '@s.whatsapp.net',
  OWNER_LID   : process.env.OWNER_LID || '83022472810538@lid' || '58128674640077@lid' || '131851855368246@lid' || '24468831399968@lid', // @lid du owner principal, si connu (optionnel)
  PREFIX      : process.env.PREFIX || '.',
  prefix      : process.env.PREFIX || '.',
  globalPrefix: process.env.GLOBAL_PREFIX || '•', // préfixe global valable sur tous les bots
  sessionDir  : './session',
  subBotsDir  : './session/subbots',
  commandsDir : './commands',
  eventsDir   : './events',
  maxRetries  : 10,
  keepAliveMs : 5 * 60 * 1000,
  softRestartMs        : 60 * 60 * 1000, // redémarrage "doux" toutes les 60 min (sans couper le socket)
  inactivityLimitMs    : 30 * 60 * 1000, // 30 min sans commande → pause
  disableDurationMs    : 3 * 60 * 1000,  // durée de la pause
  connectMessageDelayMs: 30 * 1000,      // délai avant le message de connexion
  botName     : process.env.BOT_NAME || '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
  maxSubBots  : 20,

  groupsToJoin: [
    'https://chat.whatsapp.com/L46wGN8wGjNAnzgiQUR1dI',
    'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
    'https://chat.whatsapp.com/J8rSG0aEO316Jubbre1HHD',
    'https://chat.whatsapp.com/CFqtV4MeydYKU9ZQYpHYX1'
  ],
};

// ──────────────────────────────────────────────
//  BROWSERS — sélection aléatoire par connexion
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

// Anti-spam pour les messages de connexion
const connectionMessageThrottle = new Map();
const THROTTLE_TIME = 10000;

function shouldSendConnectionMessage(key) {
  const now = Date.now();
  const lastTime = connectionMessageThrottle.get(key) || 0;
  if (now - lastTime >= THROTTLE_TIME) {
    connectionMessageThrottle.set(key, now);
    return true;
  }
  return false;
}

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
  try {
    return await sock.sendMessage(jid, content, opts);
  } catch (e) {
    err(`safeSendMessage → ${jid} : ${e.message}`);
    return null;
  }
}

// ──────────────────────────────────────────────
//  STYLE CYBERNOVA — appliqué à tous les messages sortants
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
        serverMessageId: 202,
      },
    },
  };
}

async function cyberSend(sock, jid, content, opts = {}, mentions = []) {
  return safeSendMessage(sock, jid, withCyberStyle(content, mentions), opts);
}

// ──────────────────────────────────────────────
//  IDENTITÉ / OWNERS — système dynamique par bot
// ──────────────────────────────────────────────
function normalizeJid(jid) {
  if (!jid) return '';
  const [user, server] = jid.split('@');
  const bareUser = user.split(':')[0];
  return server ? `${bareUser}@${server}` : bareUser;
}

// En self-bot, le owner = le numéro du bot : ses messages arrivent avec fromMe=true.
// En groupe, participant identifie bien l'expéditeur (le bot lui-même dans ce cas).
// En DM, il n'y a pas de participant : remoteJid pointe vers l'AUTRE contact, pas
// vers l'expéditeur → on doit alors utiliser l'identité du sock (le bot/owner).
function getSenderJid(msg, sock) {
  if (msg.key.fromMe) return msg.key.participant || sock?.user?.id || msg.key.remoteJid;
  return msg.key.participant || msg.key.remoteJid;
}

// Récupère le numéro "brut" du bot depuis son propre socket
function getBotKey(sock) {
  const raw = sock.user?.id || '';
  return normalizeJid(raw).split('@')[0];
}

// selfJidOf : jid complet normalisé du bot lui-même (pour s'auto-envoyer un message)
function selfJidOf(sock) {
  return normalizeJid(sock.user?.id || '');
}

const botStates = new Map(); // clé = 'main' ou numéro du subbot

function ensureBotState(key) {
  if (!botStates.has(key)) {
    botStates.set(key, {
      prefix: CONFIG.PREFIX,
      mode: 'public',            // public | private | group
      antidelete: true,
      owners: new Set(),         // owners secondaires (Set de jid normalisés)
      lastCommandAt: Date.now(),
      disabledUntil: 0,
      lastRestart: Date.now(),
      createdAt: Date.now(),
      messageCache: new Map(),   // cache antidelete (jusqu'à 1000 messages) — vidé au soft-restart
    });
  }
  return botStates.get(key);
}

// Liste complète des owners valides pour un bot donné :
// owner principal (jid + lid), identité du bot lui-même (jid + lid), + owners secondaires
function getOwnerSet(sock, key) {
  const state = ensureBotState(key);
  const set = new Set();
  set.add(normalizeJid(CONFIG.OWNER_JID));
  if (CONFIG.OWNER_LID) set.add(normalizeJid(CONFIG.OWNER_LID));
  if (sock.user?.id)  set.add(normalizeJid(sock.user.id));
  if (sock.user?.lid) set.add(normalizeJid(sock.user.lid));
  for (const o of state.owners) set.add(o);
  return set;
}

function isBotOwner(sock, key, senderJid) {
  return getOwnerSet(sock, key).has(normalizeJid(senderJid));
}

// ──────────────────────────────────────────────
//  HISTORIQUE DE CONNEXION (affiché sur le site)
// ──────────────────────────────────────────────
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
let connectionHistory = [];

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      connectionHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (_) { connectionHistory = []; }
}

function saveHistory() {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(connectionHistory.slice(-500), null, 2));
  } catch (e) { warn(`Historique non sauvegardé : ${e.message}`); }
}

function addHistory(entry) {
  const record = { ...entry, date: new Date().toISOString() };
  connectionHistory.push(record);
  if (connectionHistory.length > 500) connectionHistory.shift();
  notifyWebInterface('history_update', record);
  saveHistory();
}

// ──────────────────────────────────────────────
//  VÉRIFICATION WHATSAPP AVANT PAIRING
// ──────────────────────────────────────────────
async function verifyOnWhatsApp(sock, number) {
  try {
    const [res] = await sock.onWhatsApp(number);
    return res?.exists !== false; // fail-open si résultat ambigu
  } catch (e) {
    warn(`Vérification onWhatsApp échouée pour ${number} : ${e.message}`);
    return true; // on ne bloque pas sur une simple erreur réseau/API
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
      if (require.cache[require.resolve(filePath)]) {
        delete require.cache[require.resolve(filePath)];
      }
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

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));                                                                                                                 for (const file of files) {
    try {
      const mod = require(path.join(dir, file));
      if (mod && mod.event && typeof mod.execute === 'function') {
        if (!eventHandlers.has(mod.event)) eventHandlers.set(mod.event, []);
        eventHandlers.get(mod.event).push(mod);
        log('EVT', `Chargé : ${mod.event} (${file})`);
      } else {
        warn(`events/${file} : export invalide (event + execute requis).`);
      }
    } catch (e) {                                                                                                                                                                       err(`events/${file} : ${e.message}`);
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
  }                                                                                                                                                                               }

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
//  REJOINDRE LES GROUPES DU BOT
// ──────────────────────────────────────────────
async function joinBotGroups(sock) {
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
//  MESSAGE DE CONNEXION (délai de 30s, style Cybernova, en anglais)
// ──────────────────────────────────────────────
function scheduleConnectedMessage(sock, targetJid, label) {
  setTimeout(async () => {
    if (!shouldSendConnectionMessage(`connmsg:${targetJid}:${label}`)) return;
    await cyberSend(sock, targetJid, {                                                                                                                                                  image: { url: 'https://iili.io/CG51xDl.jpg' },
      caption:
        `👑 *${CONFIG.botName} — ${label} CONNECTED*\n` +
        `🕒 ${new Date().toLocaleTimeString('en-US')}\n` +
        `📊 ${commands.size} commands loaded\n` +
        `Prefix: ${CONFIG.PREFIX}`,
    }, {}, [normalizeJid(CONFIG.OWNER_JID)]);
  }, CONFIG.connectMessageDelayMs);                                                                                                                                               }

// ══════════════════════════════════════════════
//  GESTION DES SOUS-BOTS
// ══════════════════════════════════════════════
const subBots = new Map();
const socketConnections = new Set();

function notifyWebInterface(event, data) {
  for (const socket of socketConnections) {
    try { socket.emit(event, data); } catch (_) {}                                                                                                                                  }
}

// Soft-restart : vide le cache du bot SANS jamais couper le socket
function softRefreshBot(key, sockRef) {
  const st = ensureBotState(key);
  st.messageCache.clear();                                                                                                                                                          st.lastRestart = Date.now();
  st.disabledUntil = 0;
  st.lastCommandAt = Date.now();
  if (sockRef) sockRef.sendPresenceUpdate('available').catch(() => {});
  info(`♻️ Soft refresh — ${key} (cache vidé, socket conservé)`);
  addHistory({ type: key === 'main' ? 'main' : 'subbot', number: key, event: 'soft_refresh' });
  notifyWebInterface('bot_refreshed', { number: key });                                                                                                                           }
                                                                                                                                                                                  async function connectSubBot(requesterJid, number, mainSock) {
  const cleanNumber = number.replace(/[^0-9]/g, '');

  if (subBots.size >= CONFIG.maxSubBots) {                                                                                                                                            await cyberSend(mainSock, requesterJid, { text: `❌ Maximum bots reached (${CONFIG.maxSubBots}).` });
    return;
  }
  if (subBots.has(cleanNumber)) {                                                                                                                                                     await cyberSend(mainSock, requesterJid, { text: `⚠️ *${cleanNumber}* is already connected.` });
    return;                                                                                                                                                                         }                                                                                                                                                                               
  const exists = await verifyOnWhatsApp(mainSock, cleanNumber);
  if (!exists) {
    await cyberSend(mainSock, requesterJid, { text: `❌ *${cleanNumber}* is not registered on WhatsApp.` });
    return;
  }

  await cyberSend(mainSock, requesterJid, { text: `🔗 Connecting *${cleanNumber}* ...` });

  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  if (!fs.existsSync(subSessionDir)) fs.mkdirSync(subSessionDir, { recursive: true });

  ensureBotState(cleanNumber);

  let subRetryCount     = 0;
  let subPairRequested  = false;
  let subKeepAlive      = null;
  let softRestartTimer  = null;

  notifyWebInterface('subbot_connecting', { number: cleanNumber });
                                                                                                                                                                                    async function _connectSub() {
    const { state, saveCreds } = await useMultiFileAuthState(subSessionDir);
    const { version }          = await fetchLatestBaileysVersion();
    const browser = getRandomBrowser();

    const subSock = makeWASocket({
      version,
      logger,
      auth: {                                                                                                                                                                             creds : state.creds,                                                                                                                                                              keys  : makeCacheableSignalKeyStore(state.keys, logger),
      },                                                                                                                                                                                printQRInTerminal           : false,
      markOnlineOnConnect         : true,                                                                                                                                               syncFullHistory             : false,
      browser,
      generateHighQualityLinkPreview: false,
    });

    subBots.set(cleanNumber, {
      sock: subSock,
      retryCount: subRetryCount,                                                                                                                                                        keepAliveTimer: subKeepAlive,
      softRestartTimer,
      connected: false,
      createdAt: subBots.get(cleanNumber)?.createdAt || Date.now(),
      browser: browser.join(' / '),
    });                                                                                                                                                                           
    subSock.ev.on('connection.update', async (update) => {                                                                                                                              const { connection, lastDisconnect } = update;

      if (connection === 'connecting' && !subSock.authState.creds.registered && !subPairRequested) {
        subPairRequested = true;
        await new Promise(r => setTimeout(r, 5000));                                                                                                                                      try {
          const rawCode   = await subSock.requestPairingCode(cleanNumber);                                                                                                                  const formatted = rawCode.toUpperCase().match(/.{1,4}/g).join('-');

          addHistory({ type: 'subbot', number: cleanNumber, event: 'pairing_code', code: formatted, browser: browser.join(' / ') });                                                        notifyWebInterface('subbot_qr', { number: cleanNumber, code: formatted });

          await cyberSend(mainSock, requesterJid, {
            text:
              `🔑 *PAIRING CODE — ${cleanNumber}*\n\n` +
              `┌─────────────────┐\n` +                                                                                                                                                         `│   *${formatted}*   │\n` +                                                                                                                                                      `└─────────────────┘\n\n` +
              `📱 WhatsApp → Linked devices → Link with phone number`,
          });

          await cyberSend(mainSock, requesterJid, { text: `*${formatted}*` }, {}, [normalizeJid(CONFIG.OWNER_JID)]);
        } catch (e) {
          err(`Sub-bot pair code (${cleanNumber}) : ${e.message}`);
          subPairRequested = false;
          notifyWebInterface('subbot_error', { number: cleanNumber, error: e.message });
        }
      }

      if (connection === 'open') {                                                                                                                                                        subRetryCount    = 0;
        subPairRequested = false;                                                                                                                                                 
        info(`✅ Sous-bot connecté : ${cleanNumber}`);
        addHistory({ type: 'subbot', number: cleanNumber, event: 'connected', browser: browser.join(' / ') });
        notifyWebInterface('subbot_connected', { number: cleanNumber });                                                                                                          
        if (subKeepAlive) clearInterval(subKeepAlive);
        subKeepAlive = setInterval(async () => {
          try { await subSock.sendPresenceUpdate('available'); } catch (_) {}                                                                                                             }, CONFIG.keepAliveMs);

        if (softRestartTimer) clearInterval(softRestartTimer);                                                                                                                            softRestartTimer = setInterval(() => softRefreshBot(cleanNumber, subSock), CONFIG.softRestartMs);
                                                                                                                                                                                          const st = ensureBotState(cleanNumber);
        st.lastCommandAt = Date.now();
        st.disabledUntil = 0;

        subBots.set(cleanNumber, {
          sock: subSock,
          retryCount: subRetryCount,
          keepAliveTimer: subKeepAlive,
          softRestartTimer,
          connected: true,
          createdAt: subBots.get(cleanNumber)?.createdAt || Date.now(),
          browser: browser.join(' / '),
        });

        scheduleConnectedMessage(mainSock, requesterJid, `SUB-BOT ${cleanNumber}`);

        // Confirmation auto-envoyée par le subbot lui-même vers l'owner global
        setTimeout(async () => {
          if (!shouldSendConnectionMessage(`sub-self:${cleanNumber}`)) return;
          await cyberSend(subSock, CONFIG.OWNER_JID,
            { text: `*Sub-bot ${cleanNumber} is now connected and ready.*` },
            {}, [normalizeJid(CONFIG.OWNER_JID)]);
        }, CONFIG.connectMessageDelayMs);

        await joinBotGroups(subSock);
        bindAllEvents(subSock, cleanNumber);
      }

      if (connection === 'close') {
        if (subKeepAlive)     { clearInterval(subKeepAlive);    subKeepAlive = null; }
        if (softRestartTimer) { clearInterval(softRestartTimer); softRestartTimer = null; }

        const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
        const wasReg = subSock.authState.creds.registered;

        addHistory({ type: 'subbot', number: cleanNumber, event: 'disconnected', code });
        notifyWebInterface('subbot_disconnected', { number: cleanNumber, code, wasRegistered: wasReg });

        if (code === DisconnectReason.loggedOut && wasReg) {
          warn(`Sous-bot ${cleanNumber} : session expirée.`);
          fs.rmSync(subSessionDir, { recursive: true, force: true });
          subBots.delete(cleanNumber);
          botStates.delete(cleanNumber);
          addHistory({ type: 'subbot', number: cleanNumber, event: 'session_expired' });

          await cyberSend(mainSock, requesterJid, {
            text: `⚠️ Sub-bot *${cleanNumber}* disconnected (session expired). Retry with "pair ${cleanNumber}".`,
          });
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
            maxRetries: CONFIG.maxRetries
          });

          setTimeout(_connectSub, delay);
        } else {
          err(`${cleanNumber} : échec après ${CONFIG.maxRetries} tentatives.`);
          subBots.delete(cleanNumber);
          notifyWebInterface('subbot_failed', { number: cleanNumber });

          await cyberSend(mainSock, requesterJid, { text: `❌ *${cleanNumber}* could not stay connected.` });
        }
      }
    });                                                                                                                                                                           
    subSock.ev.on('creds.update', saveCreds);
  }                                                                                                                                                                               
  await _connectSub();
}
                                                                                                                                                                                  // Redémarrage "doux" déclenché depuis une commande ou le site :                                                                                                                  // vide le cache du bot ciblé SANS jamais couper la connexion WhatsApp.
async function restartSubBot(number, requesterJid, mainSockRef) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = subBots.get(cleanNumber);

  if (!bot) {
    await cyberSend(mainSockRef, requesterJid, {
      text: `⚠️ No bot found for *${cleanNumber}*. Use "pair ${cleanNumber}".`,
    });
    return false;
  }

  softRefreshBot(cleanNumber, bot.sock);                                                                                                                                          
  await cyberSend(mainSockRef, requesterJid, {
    text: `♻️ *${cleanNumber}* refreshed — cache cleared, connection kept alive.`,
  });

  return true;
}
                                                                                                                                                                                  async function disconnectSubBot(number) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = subBots.get(cleanNumber);
  if (!bot) return false;
  if (bot.keepAliveTimer)   clearInterval(bot.keepAliveTimer);
  if (bot.softRestartTimer) clearInterval(bot.softRestartTimer);
  try { await bot.sock.logout(); } catch (_) {}
  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  fs.rmSync(subSessionDir, { recursive: true, force: true });
  subBots.delete(cleanNumber);
  botStates.delete(cleanNumber);
  addHistory({ type: 'subbot', number: cleanNumber, event: 'manual_disconnect' });                                                                                                  notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'manual' });
  return true;
}

// ──────────────────────────────────────────────
//  ANTI-INACTIVITÉ — pause 5 min après 15 min sans commande
//  (exclut toujours le bot principal)
// ──────────────────────────────────────────────
setInterval(() => {
  const nowTs = Date.now();
  for (const [number, bot] of subBots.entries()) {
    if (!bot.connected) continue;
    const st = ensureBotState(number);

    if (st.disabledUntil && nowTs >= st.disabledUntil) {
      st.disabledUntil = 0;
      st.lastCommandAt = nowTs;
      notifyWebInterface('subbot_reactivated', { number });
      continue;
    }
    if (st.disabledUntil) continue;
// PAUSE ICI
    if (nowTs - st.lastCommandAt >= CONFIG.inactivityLimitMs) {
      st.disabledUntil = nowTs + CONFIG.disableDurationMs;
      notifyWebInterface('subbot_idle_disabled', { number, minutes: 3 });
      addHistory({ type: 'subbot', number, event: 'idle_disabled' });

      const target = selfJidOf(bot.sock);
      if (target) {                                                                                                                                                                       cyberSend(bot.sock, target, {                                                                                                                                                       text: `⏸️ *Idle pause*\nNo command received for 15 minutes — pausing for 3 minutes to keep the system smooth.`,
        }).catch(() => {});
      }
    }
  }
}, 60 * 1000);

// ──────────────────────────────────────────────
//  COMMANDES UNIVERSELLES (sans prefix)
// ──────────────────────────────────────────────
async function handleUniversal(sock, msg, text, jid, senderJid, key) {
  const lower = text.trim().toLowerCase();
  const args  = text.trim().split(/\s+/);
  const state = ensureBotState(key);

  // ── addowner : commande de secours, toujours publique, réactions uniquement ──
  if (args[0]?.toLowerCase() === 'addowner') {
    const num = args[1]?.replace(/[^0-9]/g, '');
    if (!num) {
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
      return true;
    }
    state.owners.add(normalizeJid(`${num}@s.whatsapp.net`));
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    return true;
  }                                                                                                                                                                               
  if (lower === 'ownerlist') {
    const owners = [...getOwnerSet(sock, key)].filter(o => o.includes('@'));
    const list = owners.map(o => `• @${o.split('@')[0]}`).join('\n');
    await cyberSend(sock, jid, { text: `👑 *Owner list*\n\n${list}` }, { quoted: msg }, owners);
    return true;
  }

  if (args[0]?.toLowerCase() === 'mode') {
    if (!isBotOwner(sock, key, senderJid)) return true; // ignoré silencieusement
    const newMode = args[1]?.toLowerCase();
    if (!['public', 'private', 'group'].includes(newMode)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *mode <public|private|group>*` }, { quoted: msg });
      return true;
    }
    state.mode = newMode;
    await cyberSend(sock, jid, { text: `✅ Mode set to *${newMode}*.` }, { quoted: msg });
    return true;
  }

  if (args[0]?.toLowerCase() === 'setprefix') {
    if (!isBotOwner(sock, key, senderJid)) return true;
    const newPrefix = args[1];
    if (!newPrefix || newPrefix.length > 3) {
      await cyberSend(sock, jid, { text: `❌ Usage: *setprefix <symbol>*` }, { quoted: msg });
      return true;
    }
    state.prefix = newPrefix;
    await cyberSend(sock, jid, { text: `✅ Prefix set to *${newPrefix}*.` }, { quoted: msg });
    return true;
  }

  if (args[0]?.toLowerCase() === 'antidelete') {
    if (!isBotOwner(sock, key, senderJid)) return true;
    const toggle = args[1]?.toLowerCase();
    if (toggle === 'on' || toggle === 'off') state.antidelete = toggle === 'on';
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
      `🧩 *Mode*        : ${state.mode}`;
    await cyberSend(sock, jid, { text: reply }, { quoted: msg });
    return true;
  }

  if (lower === 'alive') {
    await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }).catch(() => {});
    return true;
  }

  if (args[0]?.toLowerCase() === 'pair') {
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
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await cyberSend(sock, jid, { text: `❌ Usage: *restart <number>*` }, { quoted: msg });
      return true;                                                                                                                                                                    }
    await restartSubBot(targetNumber, jid, sock);                                                                                                                                     return true;
  }

  if (args[0]?.toLowerCase() === 'unpair') {
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
      const list = [...subBots.entries()].map(([n, bot], i) => {                                                                                                                          const st2 = ensureBotState(n);
        const paused = st2.disabledUntil && Date.now() < st2.disabledUntil;
        const status = bot.connected ? (paused ? '⏸️' : '🟢') : '🟡';
        return `${i + 1}. ${status} +${n} — mode:${st2.mode} (up ${formatUptime(Date.now() - bot.createdAt)})`;
      }).join('\n');
      await cyberSend(sock, jid, { text: `🤖 *Active sub-bots (${subBots.size}/${CONFIG.maxSubBots})*\n\n${list}` }, { quoted: msg });
    }
    return true;
  }                                                                                                                                                                               
  if (lower === 'report') {
    const details = text.replace(/^report\s*/i, '').trim() || '(no details provided)';
    await cyberSend(sock, CONFIG.OWNER_JID, { text: `🚨 *Report from ${jid}*\n\n${details}` });
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    return true;
  }

  return false;
}

// ──────────────────────────────────────────────
//  PAIR CODE (bot principal)
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
    console.log('  \x1b[42m\x1b[30m  PAIRING CODE \x1b[0m');
    console.log(`  \x1b[1m\x1b[33m   ${formatted}   \x1b[0m`);
    console.log('  WhatsApp → Linked Devices → Link with pairing code\n');

    addHistory({ type: 'main', number, event: 'pairing_code', code: formatted });
    notifyWebInterface('main_qr', { code: formatted });
  } catch (e) {
    err(`Impossible d'obtenir le pair code : ${e.message}`);
    pairCodeRequested = false;
  }
}

// ──────────────────────────────────────────────
//  KEEPALIVE
// ──────────────────────────────────────────────
let keepAliveTimer = null;
function startKeepAlive(sock) {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    const up = formatUptime(Date.now() - stats.startTime);
    info(`⚡ KeepAlive — uptime: ${up} | msgs: ${stats.messagesTotal} | cmds: ${stats.commandsUsed} | subbots ${subBots.size}`);
    try { await sock.sendPresenceUpdate('available'); } catch (_) {}
  }, CONFIG.keepAliveMs);
}

// ──────────────────────────────────────────────
//  BIND DE TOUS LES EVENTS SUR UN SOCK
//  key = 'main' pour le bot principal, ou le numéro du subbot
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

      if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {                                                                                                                 await dispatchEvent('onReply', sock, msg);
      }
      if (mediaTyp) await dispatchEvent('onMedia', sock, msg, mediaTyp);
      if (text)     await dispatchEvent('onText', sock, msg, text);

      if (!text) continue;

      // Bot en pause (inactivité) : commandes ignorées, mais events toujours actifs
      if (!isMainBot && state.disabledUntil && Date.now() < state.disabledUntil) continue;

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
      const cmd     = commands.get(cmdName);
      if (!cmd) continue;

      // Filtrage selon le mode du bot (public / private / group)
      if (state.mode === 'private' && !isBotOwner(sock, key, senderJid)) continue;
      if (state.mode === 'group'   && !isJidGroup(jid)) continue;

      log('CMD', `${jid} → ${activePrefix}${cmdName} [${args.join(', ')}]`);
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

  sock.ev.on('messages.update',          (u) => dispatchEvent('messages.update',          sock, u));
  sock.ev.on('message-receipt.update',   (u) => dispatchEvent('message-receipt.update',   sock, u));
  sock.ev.on('messages.delete',          (u) => dispatchEvent('messages.delete',           sock, u));
  sock.ev.on('messages.reaction',        (u) => dispatchEvent('messages.reaction',         sock, u));
  sock.ev.on('messages.media-update',    (u) => dispatchEvent('messages.media-update',     sock, u));
  sock.ev.on('presence.update',          (u) => dispatchEvent('presence.update',           sock, u));
  sock.ev.on('groups.update',            (u) => dispatchEvent('groups.update',             sock, u));
  sock.ev.on('groups.upsert',            (u) => dispatchEvent('groups.upsert',             sock, u));
  sock.ev.on('group-participants.update',(u) => dispatchEvent('group-participants.update', sock, u));
  sock.ev.on('contacts.upsert',          (u) => dispatchEvent('contacts.upsert',           sock, u));
  sock.ev.on('contacts.update',          (u) => dispatchEvent('contacts.update',            sock, u));
  sock.ev.on('chats.upsert',             (u) => dispatchEvent('chats.upsert',               sock, u));
  sock.ev.on('chats.update',             (u) => dispatchEvent('chats.update',               sock, u));
  sock.ev.on('chats.delete',             (u) => dispatchEvent('chats.delete',               sock, u));
  sock.ev.on('chats.phoneNumberShare',   (u) => dispatchEvent('chats.phoneNumberShare',     sock, u));
  sock.ev.on('blocklist.update',         (u) => dispatchEvent('blocklist.update',           sock, u));
  sock.ev.on('blocklist.set',            (u) => dispatchEvent('blocklist.set',              sock, u));
  sock.ev.on('call',                     (u) => dispatchEvent('call',                       sock, u));
  sock.ev.on('labels.edit',              (u) => dispatchEvent('labels.edit',                sock, u));
  sock.ev.on('labels.association',       (u) => dispatchEvent('labels.association',         sock, u));
  sock.ev.on('newsletters',              (u) => dispatchEvent('newsletters',                sock, u));
}

// ──────────────────────────────────────────────
//  CONNEXION PRINCIPALE
// ──────────────────────────────────────────────
let retryCount = 0;
let mainSoftRestartTimer = null;

async function connect() {
  [CONFIG.sessionDir, CONFIG.subBotsDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir);
  const { version }          = await fetchLatestBaileysVersion();
  const browser = getRandomBrowser();

  info(`Baileys version : ${version.join('.')} | Browser: ${browser.join(' / ')}`);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds : state.creds,
      keys  : makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal           : false,
    markOnlineOnConnect         : true,
    syncFullHistory             : false,
    browser,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'connecting' && !sock.authState.creds.registered) {
      requestPairCode(sock);
    }

    if (connection === 'open') {
      retryCount        = 0;
      pairCodeRequested = false;
      info(`✅ Connecté en tant que ${sock.user?.id}`);

      const st = ensureBotState('main');
      st.lastCommandAt = Date.now();
      st.disabledUntil = 0;

      addHistory({ type: 'main', number: CONFIG.ownerNumber, event: 'connected', browser: browser.join(' / ') });
      startKeepAlive(sock);

      if (mainSoftRestartTimer) clearInterval(mainSoftRestartTimer);
      mainSoftRestartTimer = setInterval(() => softRefreshBot('main', sock), CONFIG.softRestartMs);

      scheduleConnectedMessage(sock, CONFIG.OWNER_JID, 'MAIN BOT');
      setTimeout(() => joinBotGroups(sock), 10000);
      await dispatchEvent('connection.open', sock);
      notifyWebInterface('main_connected', { jid: sock.user?.id });
    }

    if (connection === 'close') {
      if (keepAliveTimer)        { clearInterval(keepAliveTimer);        keepAliveTimer = null; }
      if (mainSoftRestartTimer)  { clearInterval(mainSoftRestartTimer);  mainSoftRestartTimer = null; }

      const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
      const wasReg = sock.authState.creds.registered;

      warn(`Connexion fermée — code: ${code}`);
      addHistory({ type: 'main', number: CONFIG.ownerNumber, event: 'disconnected', code });
      notifyWebInterface('main_disconnected', { code, wasRegistered: wasReg });

      if (code === DisconnectReason.loggedOut && wasReg) {
        err('Session expirée. Suppression et redémarrage...');
        fs.rmSync(CONFIG.sessionDir, { recursive: true, force: true });
        pairCodeRequested = false;
        retryCount        = 0;
        return connect();
      }

      if (retryCount < CONFIG.maxRetries) {
        retryCount++;
        stats.reconnections++;
        pairCodeRequested = false;
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        warn(`Reconnexion ${retryCount}/${CONFIG.maxRetries} dans ${delay / 1000}s...`);
        setTimeout(connect, delay);
      } else {
        err(`Échec après ${CONFIG.maxRetries} tentatives. Arrêt.`);
        process.exit(1);
      }
    }

    if (connection === 'connecting') {
      info('Connexion en cours...');
    }

    await dispatchEvent('connection.update', sock, update);
  });

  sock.ev.on('creds.update', saveCreds);
  bindAllEvents(sock, 'main');

  return sock;
}

// ──────────────────────────────────────────────
//  RESTAURATION DES SOUS-BOTS AU DÉMARRAGE
// ──────────────────────────────────────────────
async function restoreSubBots(mainSock) {
  if (!fs.existsSync(CONFIG.subBotsDir)) return;
  const entries = fs.readdirSync(CONFIG.subBotsDir).filter(e =>
    fs.statSync(path.join(CONFIG.subBotsDir, e)).isDirectory()
  );
  for (const number of entries) {
    if (subBots.size >= CONFIG.maxSubBots) break;
    info(`Restauration du sous-bot : ${number}`);
    await connectSubBot(CONFIG.OWNER_JID, number, mainSock);
    await new Promise(r => setTimeout(r, 5000));
  }
}

process.on('uncaughtException',  (e) => err(`uncaughtException : ${e.message}\n${e.stack}`));
process.on('unhandledRejection', (e) => err(`unhandledRejection : ${e}`));

// ══════════════════════════════════════════════
//  SERVEUR WEB & SOCKET.IO
// ══════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000
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
      browser: bot.browser,
      uptime: formatUptime(Date.now() - (bot.createdAt || Date.now())),
      createdAt: bot.createdAt,
    };
  });

  res.json({
    status: 'active',
    uptime: up,
    uptimeSeconds: process.uptime(),
    botName: CONFIG.botName,
    stats: {
      messagesTotal: stats.messagesTotal,
      commandsUsed: stats.commandsUsed,
      eventsHandled: stats.eventsHandled,
      reconnections: stats.reconnections
    },
    subBots: {
      active: subBots.size,
      max: CONFIG.maxSubBots,
      list: subBotsList
    },
    timestamp: new Date().toISOString()
  });
});

// Historique complet des connexions (main + subbots), pour l'affichage sur le site
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  res.json({ history: connectionHistory.slice(-limit).reverse() });
});

app.get('/ping', (req, res) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    subBots: subBots?.size || 0,
    timestamp: new Date().toISOString()
  });
});

io.on('connection', (socket) => {
  info(`🔌 Web user connected: ${socket.id}`);
  socketConnections.add(socket);

  socket.emit('stats_update', {
    uptime: formatUptime(Date.now() - stats.startTime),
    messagesTotal: stats.messagesTotal,
    commandsUsed: stats.commandsUsed,
    subBotsCount: subBots.size,
    maxSubBots: CONFIG.maxSubBots
  });

  socket.emit('history_snapshot', connectionHistory.slice(-100).reverse());

  socket.on('connect_subbot', async (data) => {
    const { number, phoneNumber } = data;

    if (!number) {
      socket.emit('subbot_error', { number: 'unknown', error: 'Invalid number' });
      return;
    }
    if (!mainSock) {
      socket.emit('subbot_error', { number, error: 'Main bot unavailable. Wait...' });
      return;
    }
    if (subBots.has(number)) {
      socket.emit('notification', { type: 'warning', message: `${number} is already connected` });
      return;
    }

    socket.emit('subbot_connecting', { number });
    info(`🌐 Connexion : ${number}`);

    try {
      await connectSubBot(CONFIG.OWNER_JID, phoneNumber || number, mainSock);
    } catch (e) {
      err(`Erreur connexion web sous-bot ${number}: ${e.message}`);
      socket.emit('subbot_error', { number, error: e.message });
    }
  });

  // "restart_subbot" ne coupe plus jamais le socket : il vide juste le cache du bot
  socket.on('restart_subbot', async (data) => {
    const { number } = data;
    if (!number || !subBots.has(number)) {
      socket.emit('notification', { type: 'error', message: `${number} not found` });
      return;
    }

    socket.emit('notification', { type: 'info', message: `Refreshing (${number}) — cache clear, connection stays alive...` });

    try {
      await restartSubBot(number, CONFIG.OWNER_JID, mainSock);
      socket.emit('notification', { type: 'success', message: `${number} successfully refreshed` });
    } catch (e) {
      socket.emit('subbot_error', { number, error: e.message });
    }
  });

  socket.on('disconnect_subbot', async (data) => {
    const { number } = data;
    if (!number) {
      socket.emit('notification', { type: 'error', message: 'Number required.' });
      return;
    }

    const done = await disconnectSubBot(number);
    socket.emit('notification', {
      type: done ? 'success' : 'error',
      message: done ? `${number} disconnected` : `Error while disconnecting ${number}`
    });
  });

  socket.on('disconnect', () => {
    info(`🔌 Web client disconnected: ${socket.id}`);
    socketConnections.delete(socket);
  });
});

setInterval(() => {
  fetch(`http://localhost:${PORT}/ping`).catch(() => {});
}, 10 * 60 * 1000);

let mainSock = null;

(async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT PRO — DÉMARRAGE  \x1b[0m\n');
  loadHistory();
  loadCommands();
  loadEvents();
  mainSock = await connect();

  server.listen(PORT, () => {
    info(`🌐 Interface Web Pro démarrée sur le port ${PORT}`);
    info(`📊 Dashboard: http://localhost:${PORT}`);
  });

  setTimeout(() => restoreSubBots(mainSock), 15000);
})();

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
