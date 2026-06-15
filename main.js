'use strict';

// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — main.js (CommonJS)               ║
// ║     Session Permanente · Pair Code · Baileys · Render       ║
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

// ──────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────
const CONFIG = {
  ownerNumber : process.env.OWNER_NUMBER || '584168698003',
  OWNER_JID   : (process.env.OWNER_NUMBER || '584168698003') + '@s.whatsapp.net',
  PREFIX      : process.env.PREFIX || '•',
  prefix      : process.env.PREFIX || '.',
  sessionDir  : './session',
  subBotsDir  : './session/subbots',
  commandsDir : './commands',
  eventsDir   : './events',
  maxRetries  : 5,
  keepAliveMs : 5 * 60 * 1000,
  botName     : process.env.BOT_NAME || '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
  maxSubBots  : 10,

  groupsToJoin: [
    'https://chat.whatsapp.com/D9ZE6hOH6pm47GBjoeXpov',
    'https://chat.whatsapp.com/FPE3RV3sH5iGTjlSP7N8Fw',
    'https://chat.whatsapp.com/L46wGN8wGjNAnzgiQUR1dI',
  ],
};

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
//  NOTIFICATION OWNER
// ──────────────────────────────────────────────
async function sendOwnerNotification(sock) {
  setTimeout(async () => {
    await safeSendMessage(sock, CONFIG.OWNER_JID, {
      image: { url: 'https://files.catbox.moe/uklx8n.jpg' },
      caption:
        `👑 *${CONFIG.botName} BOT CONNECTÉ*\n` +
        `📡 Status : ONLINE\n` +
        `⚡ Actif 24/7\n` +
        `🕒 ${new Date().toLocaleTimeString()}\n` +
        `📊 ${commands.size} commandes\n` +
        `Prefix = ${CONFIG.PREFIX}`,
      contextInfo: {
        mentionedJid: [CONFIG.OWNER_JID],
        forwardingScore: 350,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363425394543602@newsletter',
          newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
          serverMessageId: 195,
        },
      },
    });
  }, 2000);
}

// ══════════════════════════════════════════════
//  GESTION DES SOUS-BOTS
// ══════════════════════════════════════════════
const subBots = new Map();

async function connectSubBot(requesterJid, number, mainSock) {
  const cleanNumber = number.replace(/[^0-9]/g, '');

  if (subBots.size >= CONFIG.maxSubBots) {
    await safeSendMessage(mainSock, requesterJid, {
      text: `❌ Maximum de sous-bots atteint (${CONFIG.maxSubBots}).`,
    });
    return;
  }

  if (subBots.has(cleanNumber)) {
    await safeSendMessage(mainSock, requesterJid, {
      text: `⚠️ Le numéro *${cleanNumber}* est déjà connecté comme sous-bot.`,
    });
    return;
  }

  await safeSendMessage(mainSock, requesterJid, {
    text: `🔗 Connexion sub-bot *${cleanNumber}* ...`,
  });

  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  if (!fs.existsSync(subSessionDir)) fs.mkdirSync(subSessionDir, { recursive: true });

  let subRetryCount   = 0;
  let subPairRequested = false;
  let subKeepAlive    = null;

  async function _connectSub() {
    const { state, saveCreds } = await useMultiFileAuthState(subSessionDir);
    const { version }          = await fetchLatestBaileysVersion();

    const subSock = makeWASocket({
      version,
      logger,
      auth: {
        creds : state.creds,
        keys  : makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal           : false,
      markOnlineOnConnect         : true,
      syncFullHistory             : false,
      browser                     : ['Mac OS', 'Firefox', '1.0.0'],
      generateHighQualityLinkPreview: false,
    });

    subBots.set(cleanNumber, { sock: subSock, retryCount: subRetryCount, keepAliveTimer: subKeepAlive });

    subSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting' && !subSock.authState.creds.registered && !subPairRequested) {
        subPairRequested = true;
        await new Promise(r => setTimeout(r, 5000));
        try {
          const code      = await subSock.requestPairingCode(cleanNumber);
          const formatted = code.match(/.{1,4}/g).join('-');
          await safeSendMessage(mainSock, requesterJid, {
            text:
              `🔑 *CODE DE JUMELAGE pour ${cleanNumber}*\n\n` +
              `┌─────────────────┐\n` +
              `│  *${formatted}*  │\n` +
              `└─────────────────┘\n\n` +
              `📱 WhatsApp → Appareils liés → Lier avec un numéro`,
          });

          await safeSendMessage(mainSock, requesterJid, {
            text:`*${formatted}*`,
            contextInfo: {
              mentionedJid: [CONFIG.OWNER_JID],
              forwardingScore: 355,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: '120363425394543602@newsletter',
                newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                serverMessageId: 202,
              },
            },
          });
        } catch (e) {
          err(`Sub-bot pair code (${cleanNumber}) : ${e.message}`);
          subPairRequested = false;
        }
      }

      if (connection === 'open') {
        subRetryCount    = 0;
        subPairRequested = false;
        info(`✅ Sous-bot connected: ${cleanNumber}`);

        if (subKeepAlive) clearInterval(subKeepAlive);
        subKeepAlive = setInterval(async () => {
          try { await subSock.sendPresenceUpdate('available'); } catch (_) {}
        }, CONFIG.keepAliveMs);
        subBots.set(cleanNumber, { sock: subSock, retryCount: subRetryCount, keepAliveTimer: subKeepAlive });

        await safeSendMessage(mainSock, requesterJid, {
          text:`*Connected Succesfully*`,
          contextInfo: {
            mentionedJid: [CONFIG.OWNER_JID],
            forwardingScore: 352,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363425394543602@newsletter',
              newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
              serverMessageId: 202,
            },
          },
        });

        await joinBotGroups(subSock);

        await safeSendMessage(subSock, CONFIG.OWNER_JID, {
          text:`*Subbot connected !*`,
          contextInfo: {
            mentionedJid: [CONFIG.OWNER_JID],
            forwardingScore: 355,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363425394543602@newsletter',
              newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
              serverMessageId: 202,
            },
          },
        });

        bindAllEvents(subSock);
      }

      if (connection === 'close') {
        if (subKeepAlive) { clearInterval(subKeepAlive); subKeepAlive = null; }

        const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
        const wasReg = subSock.authState.creds.registered;

        if (code === DisconnectReason.loggedOut && wasReg) {
          warn(`Sous-bot ${cleanNumber} : session expirée.`);
          fs.rmSync(subSessionDir, { recursive: true, force: true });
          subBots.delete(cleanNumber);
          await safeSendMessage(mainSock, requesterJid, {
            text: `⚠️ Sous-bot *${cleanNumber}* déconnecté (session expirée). Relancez "pair ${cleanNumber}".`,
          });
          return;
        }

        if (subRetryCount < CONFIG.maxRetries) {
          subRetryCount++;
          subPairRequested = false;
          const delay = Math.min(1000 * 2 ** subRetryCount, 30000);
          warn(`Sous-bot ${cleanNumber} : reconnexion ${subRetryCount}/${CONFIG.maxRetries} dans ${delay / 1000}s...`);
          setTimeout(_connectSub, delay);
        } else {
          err(`Sous-bot ${cleanNumber} : échec après ${CONFIG.maxRetries} tentatives.`);
          subBots.delete(cleanNumber);
          await safeSendMessage(mainSock, requesterJid, {
            text: `❌ Sous-bot *${cleanNumber}* définitivement déconnecté.`,
          });
        }
      }
    });

    subSock.ev.on('creds.update', saveCreds);
  }

  await _connectSub();
}

async function disconnectSubBot(number) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  const bot = subBots.get(cleanNumber);
  if (!bot) return false;
  if (bot.keepAliveTimer) clearInterval(bot.keepAliveTimer);
  try { await bot.sock.logout(); } catch (_) {}
  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  fs.rmSync(subSessionDir, { recursive: true, force: true });
  subBots.delete(cleanNumber);
  return true;
}

// ──────────────────────────────────────────────
//  COMMANDES UNIVERSELLES (sans prefix)
// ──────────────────────────────────────────────
async function handleUniversal(sock, msg, text, jid) {
  const lower = text.trim().toLowerCase();
  const args  = text.trim().split(/\s+/);

  if (lower === 'stat') {
    const up = formatUptime(Date.now() - stats.startTime);
    const reply =
      `╔═══════════════════════╗\n` +
      `║   📊 *${CONFIG.botName}*   ║\n` +
      `╚═══════════════════════╝\n` +
      `⏱ *Uptime*       : ${up}\n` +
      `💬 *Messages*    : ${stats.messagesTotal}\n` +
      `⚡ *Commands*   : ${stats.commandsUsed}\n` +
      `🎯 *Événements*  : ${stats.eventsHandled}\n` +
      `🔄 *Reconnexion*: ${stats.reconnections}\n` +
      `🤖 *Sub-bots*   : ${subBots.size}/${CONFIG.maxSubBots}`;
    await safeSendMessage(sock, jid, { text: reply }, { quoted: msg });
    return true;
  }

  if (lower === 'alive') {
    await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }).catch(() => {});
    return true;
  }

  if (args[0]?.toLowerCase() === 'pair') {
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await safeSendMessage(sock, jid, {
        text: `❌ Usage : *pair <numéro>*\nExemple : pair +22960000000`,
      }, { quoted: msg });
      return true;
    }
    if (subBots.size >= CONFIG.maxSubBots) {
      await safeSendMessage(sock, jid, {
        text: `❌ Limite atteinte : ${CONFIG.maxSubBots} sous-bots maximum.\nActifs : ${[...subBots.keys()].join(', ')}`,
      }, { quoted: msg });
      return true;
    }
    connectSubBot(jid, targetNumber, sock).catch(e => err(`connectSubBot : ${e.message}`));
    return true;
  }

  if (args[0]?.toLowerCase() === 'unpair') {
    const targetNumber = args[1];
    if (!targetNumber) {
      await safeSendMessage(sock, jid, { text: `❌ Usage : *unpair <numéro>*` }, { quoted: msg });
      return true;
    }
    const done = await disconnectSubBot(targetNumber);
    await safeSendMessage(sock, jid, {
      text: done
        ? `✅ Sous-bot *${targetNumber}* déconnecté.`
        : `⚠️ Aucun sous-bot avec le numéro *${targetNumber}*.`,
    }, { quoted: msg });
    return true;
  }

  if (lower === 'subbots') {
    if (subBots.size === 0) {
      await safeSendMessage(sock, jid, { text: `🤖 Aucun sous-bot actif.` }, { quoted: msg });
    } else {
      const list = [...subBots.keys()].map((n, i) => `${i + 1}. +${n}`).join('\n');
      await safeSendMessage(sock, jid, {
        text: `🤖 *Sous-bots actifs (${subBots.size}/${CONFIG.maxSubBots})*\n\n${list}`,
      }, { quoted: msg });
    }
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
    const code      = await sock.requestPairingCode(number);
    const formatted = code.match(/.{1,4}/g).join('-');
    console.log('\n');
    console.log('  \x1b[42m\x1b[30m  VOTRE CODE DE JUMELAGE  \x1b[0m');
    console.log(`  \x1b[1m\x1b[33m  ${formatted}  \x1b[0m`);
    console.log('  Entrez ce code dans WhatsApp → Appareils liés → Lier avec un numéro\n');
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
    info(`⚡ KeepAlive — uptime: ${up} | msgs: ${stats.messagesTotal} | cmds: ${stats.commandsUsed} | sous-bots: ${subBots.size}`);
    try { await sock.sendPresenceUpdate('available'); } catch (_) {}
  }, CONFIG.keepAliveMs);
}

// ──────────────────────────────────────────────
//  BIND DE TOUS LES EVENTS SUR UN SOCK
// ──────────────────────────────────────────────
function bindAllEvents(sock) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    await dispatchEvent('messages.upsert', sock, { messages, type });

    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;

      stats.messagesTotal++;

      const jid      = msg.key.remoteJid;
      const text     = extractText(msg).trim();
      const mediaTyp = getMediaType(msg);

      if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        await dispatchEvent('onReply', sock, msg);
      }

      if (mediaTyp) {
        await dispatchEvent('onMedia', sock, msg, mediaTyp);
      }

      if (text) {
        await dispatchEvent('onText', sock, msg, text);
      }

      if (!text) continue;

      try {
        const handled = await handleUniversal(sock, msg, text, jid);
        if (handled) { stats.commandsUsed++; continue; }
      } catch (e) {
        err(`Universal handler : ${e.message}`);
        await safeSendMessage(sock, jid, { text: `❌ Erreur : ${e.message}` }, { quoted: msg });
      }

      if (!text.startsWith(CONFIG.prefix)) continue;

      const args    = text.slice(CONFIG.prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();
      const cmd     = commands.get(cmdName);

      if (!cmd) continue;

      log('CMD', `${jid} → ${CONFIG.prefix}${cmdName} [${args.join(', ')}]`);
      stats.commandsUsed++;

      try {
        await cmd.execute({ sock, msg, args, jid, text, config: CONFIG, stats, subBots });
      } catch (e) {
        err(`Commande [${cmdName}] : ${e.message}`);
        await safeSendMessage(sock, jid,
          { text: `❌ Erreur commande *${cmdName}* :\n${e.message}` },
          { quoted: msg }
        );
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

async function connect() {
  [CONFIG.sessionDir, CONFIG.subBotsDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir);
  const { version }          = await fetchLatestBaileysVersion();

  info(`Baileys version : ${version.join('.')}`);

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
    browser                     : ['Mac OS', 'Chrome', '1.0.0'],
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
      startKeepAlive(sock);
      await sendOwnerNotification(sock);
      setTimeout(() => joinBotGroups(sock), 10000);
      await dispatchEvent('connection.open', sock);
    }

    if (connection === 'close') {
      if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }

      const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
      const wasReg = sock.authState.creds.registered;

      warn(`Connexion fermée — code: ${code}`);

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
  bindAllEvents(sock);

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

(async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT — DÉMARRAGE  \x1b[0m\n');
  loadCommands();
  loadEvents();
  const mainSock = await connect();
  setTimeout(() => restoreSubBots(mainSock), 15000);
})();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ZENITSU BOT</title>
            <meta http-equiv="refresh" content="300">
            <style>
                body {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-family: Arial;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    background: rgba(0,0,0,0.5);
                    padding: 40px;
                    border-radius: 20px;
                }
                .status {
                    color: #4ade80;
                    font-size: 20px;
                    margin-top: 20px;
                }
                .stats {
                    margin-top: 20px;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ZENITSU BOT</h1>
                <div class="status">🟢 BOT ONLINE</div>
                <div class="stats">
                    📊 Uptime: ${process.uptime().toFixed(0)}s<br>
                    🤖 Sous-bots: ${subBots?.size || 0}/10<br>
                    ⏰ ${new Date().toLocaleString()}
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/ping', (req, res) => {
    res.json({
        status: 'active',
        uptime: process.uptime(),
        subBots: subBots?.size || 0,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    info(`🌐 Serveur HTTP démarré sur le port ${PORT}`);
    info(`📊 Page de monitoring: https://votre-render-url.onrender.com`);
});

// Ping automatique toutes les 10 minutes pour garder le bot actif
setInterval(() => {
    fetch(`http://localhost:${PORT}/ping`).catch(() => {});
}, 10 * 60 * 1000);
module.exports = {
  commands,
  eventHandlers,
  stats,
  CONFIG,
  subBots,
  safeSendMessage,
  connectSubBot,
  disconnectSubBot,
}
