'use strict';

// ╔══════════════════════════════════════════════════════════════╗
// ║              ZENITSU BOT — main.js (CommonJS)               ║
// ║     Session Permanente · Pair Code · Baileys · Render       ║
// ║        Version Pro avec Interface Web Avancée               ║
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
  ownerNumber : process.env.OWNER_NUMBER || '50935948231',
  OWNER_JID   : (process.env.OWNER_NUMBER || '50935948231') + '@s.whatsapp.net',
  PREFIX      : process.env.PREFIX || '.',
  prefix      : process.env.PREFIX || '.',
  sessionDir  : './session',
  subBotsDir  : './session/subbots',
  commandsDir : './commands',
  eventsDir   : './events',
  maxRetries  : 5,
  keepAliveMs : 5 * 60 * 1000,
  botName     : process.env.BOT_NAME || '𝙯𝙚𝙣𝙞𝙩𝙨𝙪 ᗰᎥᑎᎥ',
  maxSubBots  : 50,

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

// Anti-spam pour les messages de connexion
const connectionMessageThrottle = new Map();
const THROTTLE_TIME = 3000; // 5 secondes minimum entre messages de connexion

function shouldSendConnectionMessage(jid) {
  const now = Date.now();
  const lastTime = connectionMessageThrottle.get(jid) || 0;
  if (now - lastTime >= THROTTLE_TIME) {
    connectionMessageThrottle.set(jid, now);
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
    if (!shouldSendConnectionMessage(CONFIG.OWNER_JID)) return;
    
    await safeSendMessage(sock, CONFIG.OWNER_JID, {
      image: { url: 'https://files.catbox.moe/uklx8n.jpg' },
      caption:
        `👑 *${CONFIG.botName} BOT CONNECTÉ*\n` +
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
          serverMessageId: 202,
        },
      },
    });
  }, 2000);
}

// ══════════════════════════════════════════════
//  GESTION DES SOUS-BOTS (AMÉLIORÉE)
// ══════════════════════════════════════════════
const subBots = new Map();

// Stockage des connexions Socket.IO pour les notifications web
const socketConnections = new Set();

async function connectSubBot(requesterJid, number, mainSock) {
  const cleanNumber = number.replace(/[^0-9]/g, '');

  if (subBots.size >= CONFIG.maxSubBots) {
    await safeSendMessage(mainSock, requesterJid, {
      text: `❌ Max bot (${CONFIG.maxSubBots}).`,
    });
    return;
  }

  if (subBots.has(cleanNumber)) {
    await safeSendMessage(mainSock, requesterJid, {
      text: `⚠️  *${cleanNumber}* is already connected`,
    });
    return;
  }

  await safeSendMessage(mainSock, requesterJid, {
    text: `🔗 Connexion for *${cleanNumber}* ...`,
  });

  const subSessionDir = path.join(CONFIG.subBotsDir, cleanNumber);
  if (!fs.existsSync(subSessionDir)) fs.mkdirSync(subSessionDir, { recursive: true });

  let subRetryCount   = 0;
  let subPairRequested = false;
  let subKeepAlive    = null;
  let connectionMessageSent = false; // Anti-spam local

  // Notifier l'interface web
  notifyWebInterface('subbot_connecting', { number: cleanNumber });

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

    subBots.set(cleanNumber, { 
      sock: subSock, 
      retryCount: subRetryCount, 
      keepAliveTimer: subKeepAlive,
      connected: false,
      createdAt: Date.now()
    });

    subSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'connecting' && !subSock.authState.creds.registered && !subPairRequested) {
        subPairRequested = true;
        await new Promise(r => setTimeout(r, 5000));
        try {
          const code      = await subSock.requestPairingCode(cleanNumber);
          const formatted = code.match(/.{1,4}/g).join('-');
          
          notifyWebInterface('subbot_qr', { number: cleanNumber, code: formatted });
          
          await safeSendMessage(mainSock, requesterJid, {
            text:
              `🔑 *CODE for ${cleanNumber}*\n\n` +
              `┌─────────────────┐\n` +
              `│  *${formatted}*  │\n` +
              `└─────────────────┘\n\n` +
              `📱 WhatsApp → Linked devices → Link with phone number`,
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
          notifyWebInterface('subbot_error', { number: cleanNumber, error: e.message });
        }
      }

      if (connection === 'open') {
        subRetryCount    = 0;
        subPairRequested = false;
        connectionMessageSent = true;
        
        info(`✅ Sous-bot connected: ${cleanNumber}`);
        notifyWebInterface('subbot_connected', { number: cleanNumber });

        if (subKeepAlive) clearInterval(subKeepAlive);
        subKeepAlive = setInterval(async () => {
          try { await subSock.sendPresenceUpdate('available'); } catch (_) {}
        }, CONFIG.keepAliveMs);
        
        subBots.set(cleanNumber, { 
          sock: subSock, 
          retryCount: subRetryCount, 
          keepAliveTimer: subKeepAlive,
          connected: true,
          createdAt: Date.now()
        });

        // Anti-spam : n'envoyer "Connected Successfully" qu'une seule fois
        if (shouldSendConnectionMessage(requesterJid)) {
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
        }

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

        notifyWebInterface('subbot_disconnected', { 
          number: cleanNumber, 
          code, 
          wasRegistered: wasReg 
        });

        if (code === DisconnectReason.loggedOut && wasReg) {
          warn(`Sous-bot ${cleanNumber} : session expirée.`);
          fs.rmSync(subSessionDir, { recursive: true, force: true });
          subBots.delete(cleanNumber);
          connectionMessageSent = false;
          notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'session_expired' });
          
          await safeSendMessage(mainSock, requesterJid, {
            text: `⚠️ Sous-bot *${cleanNumber}* disconnected (session expired). Retry "pair ${cleanNumber}".`,
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
          err(` ${cleanNumber} : failure after ${CONFIG.maxRetries} attemps.`);
          subBots.delete(cleanNumber);
          connectionMessageSent = false;
          notifyWebInterface('subbot_failed', { number: cleanNumber });
          
          await safeSendMessage(mainSock, requesterJid, {
            text: `❌ *${cleanNumber}* disconnected`,
          });
        }
      }
    });

    subSock.ev.on('creds.update', saveCreds);
  }

  await _connectSub();
}

async function restartSubBot(number, requesterJid, mainSock) {
  const cleanNumber = number.replace(/[^0-9]/g, '');
  
  if (!subBots.has(cleanNumber)) {
    await safeSendMessage(mainSock, requesterJid, {
      text: `⚠️ Any bot with *${cleanNumber}*. Use "pair ${cleanNumber}"`,
    });
    return false;
  }

  info(`🔄 Restart ${cleanNumber}`);
  notifyWebInterface('subbot_restarting', { number: cleanNumber });
  
  // Déconnecter d'abord
  await disconnectSubBot(cleanNumber);
  
  // Attendre un peu
  await new Promise(r => setTimeout(r, 3000));
  
  // Reconnexion
  await connectSubBot(requesterJid, cleanNumber, mainSock);
  
  await safeSendMessage(mainSock, requesterJid, {
    text: `🔄 *${cleanNumber}* restarted.`,
  });
  
  return true;
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
  notifyWebInterface('subbot_removed', { number: cleanNumber, reason: 'manual' });
  return true;
}

// Fonction pour notifier l'interface web
function notifyWebInterface(event, data) {
  for (const socket of socketConnections) {
    try {
      socket.emit(event, data);
    } catch (e) {
      // Ignorer les erreurs de socket
    }
  }
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
        text: `❌ Limit  : ${CONFIG.maxSubBots} sous-bots maximum.\nActive : ${[...subBots.keys()].join(', ')}`,
      }, { quoted: msg });
      return true;
    }
    connectSubBot(jid, targetNumber, sock).catch(e => err(`connectSubBot : ${e.message}`));
    return true;
  }

  // Nouvelle commande restart
  if (args[0]?.toLowerCase() === 'restart') {
    const targetNumber = args[1];
    if (!targetNumber || !/^\+?[0-9]{7,15}$/.test(targetNumber)) {
      await safeSendMessage(sock, jid, {
        text: `❌ Usage : *restart <numéro>*\n`,
      }, { quoted: msg });
      return true;
    }
    await restartSubBot(targetNumber, jid, sock);
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
        ? `✅  *${targetNumber}* disconnected.`
        : `⚠️ Any bot with *${targetNumber}*.`,
    }, { quoted: msg });
    return true;
  }

  if (lower === 'subbots') {
    if (subBots.size === 0) {
      await safeSendMessage(sock, jid, { text: `🤖 Any active subbots` }, { quoted: msg });
    } else {
      const list = [...subBots.entries()].map(([n, bot], i) => {
        const status = bot.connected ? '🟢' : '🟡';
        return `${i + 1}. ${status} +${n} (depuis ${formatUptime(Date.now() - bot.createdAt)})`;
      }).join('\n');
      await safeSendMessage(sock, jid, {
        text: `🤖 *Active subbots (${subBots.size}/${CONFIG.maxSubBots})*\n\n${list}`,
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
    browser                     : ['Windows 11', 'Chrome', '135.0.7103.114'],
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
      notifyWebInterface('main_connected', { jid: sock.user?.id });
    }

    if (connection === 'close') {
      if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }

      const code   = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
      const wasReg = sock.authState.creds.registered;

      warn(`Connexion fermée — code: ${code}`);
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

// ══════════════════════════════════════════════
//  SERVEUR WEB & SOCKET.IO (AMÉLIORÉ)
// ══════════════════════════════════════════════
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000
});

const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Page principale - Interface Pro
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API REST pour les stats
app.get('/api/stats', (req, res) => {
  const up = formatUptime(Date.now() - stats.startTime);
  const subBotsList = [...subBots.entries()].map(([number, bot]) => ({
    number,
    connected: bot.connected || false,
    uptime: formatUptime(Date.now() - (bot.createdAt || Date.now())),
    createdAt: bot.createdAt
  }));

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

app.get('/ping', (req, res) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    subBots: subBots?.size || 0,
    timestamp: new Date().toISOString()
  });
});

// Socket.IO pour la communication en temps réel
// Socket.IO pour la communication en temps réel
io.on('connection', (socket) => {
  info(`🔌 Web user connected: ${socket.id}`);
  socketConnections.add(socket);

  // Envoyer les stats actuelles
  socket.emit('stats_update', {
    uptime: formatUptime(Date.now() - stats.startTime),
    messagesTotal: stats.messagesTotal,
    commandsUsed: stats.commandsUsed,
    subBotsCount: subBots.size,
    maxSubBots: CONFIG.maxSubBots
  });

  // NOUVEAU : Connecter un sous-bot depuis l'interface web
  socket.on('connect_subbot', async (data) => {
    const { number, phoneNumber } = data;
    
    if (!number) {
      socket.emit('subbot_error', { 
        number: 'unknown', 
        error: 'Invalid number' 
      });
      return;
    }
    
    if (!mainSock) {
      socket.emit('subbot_error', { 
        number, 
        error: 'Main bot unavailable . Wait...' 
      });
      return;
    }
    
    if (subBots.has(number)) {
      socket.emit('notification', { 
        type: 'warning', 
        message: `${number} is Already connected` 
      });
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

  // Commande pour redémarrer un sous-bot depuis l'interface web
  socket.on('restart_subbot', async (data) => {
    const { number } = data;
    if (!number || !subBots.has(number)) {
      socket.emit('notification', { 
        type: 'error',
        message: ` ${number} not found` 
      });
      return;
    }
    
    socket.emit('subbot_restarting', { number });
    socket.emit('notification', { 
      type: 'info', 
      message: `Restartinng ( ${number} ) ...` 
    });
    
    try {
      await restartSubBot(number, CONFIG.OWNER_JID, mainSock);
      socket.emit('notification', { 
        type: 'success', 
        message: ` ${number} succefully restarted` 
      });
    } catch (e) {
      socket.emit('subbot_error', { number, error: e.message });
    }
  });

  // Commande pour déconnecter un sous-bot
  socket.on('disconnect_subbot', async (data) => {
    const { number } = data;
    if (!number) {
      socket.emit('notification', { 
        type: 'error', 
        message: 'Number required.' 
      });
      return;
    }
    
    const done = await disconnectSubBot(number);
    socket.emit('notification', { 
      type: done ? 'success' : 'error', 
      message: done ? `${number} déconnected` : `Error while connecting ${number}` 
    });
  });

  socket.on('disconnect', () => {
    info(`🔌 Web client disconnectef: ${socket.id}`);
    socketConnections.delete(socket);
  });
});
// Ping automatique toutes les 10 minutes pour garder le bot actif
setInterval(() => {
  fetch(`http://localhost:${PORT}/ping`).catch(() => {});
}, 10 * 60 * 1000);

// Variable globale pour le socket principal (pour l'interface web)
let mainSock = null;

(async () => {
  console.log('\n  \x1b[45m\x1b[37m  ⚡ ZENITSU BOT PRO — DÉMARRAGE  \x1b[0m\n');
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
  safeSendMessage,
  connectSubBot,
  disconnectSubBot,
  restartSubBot,
};
