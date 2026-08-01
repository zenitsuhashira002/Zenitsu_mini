// ./commands/qr.js

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

const logger = pino({ level: 'silent' });
const subBotsDir = './session/subbots';
if (!fs.existsSync(subBotsDir)) fs.mkdirSync(subBotsDir, { recursive: true });

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

function getRandomBrowser() {
    return BROWSERS[Math.floor(Math.random() * BROWSERS.length)];
}

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// RÉCUPÉRATION DES BOTS ACTIFS
// ═══════════════════════════════════════

function getActiveSubBots() {
    try {
        if (global.subBots && global.subBots instanceof Map) {
            return Array.from(global.subBots.keys());
        }
        return [];
    } catch (_) {
        return [];
    }
}

// ═══════════════════════════════════════
// VÉRIFICATION OWNER
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

async function isOwner(sock, senderJid) {
    try {
        const main = require('../main.js');
        if (main && typeof main.isBotOwner === 'function') {
            const botKey = 'main';
            return main.isBotOwner(sock, botKey, senderJid);
        }
    } catch (_) {}
    
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    return getRawNumber(senderJid) === ownerNumber;
}

// ═══════════════════════════════════════
// GÉNÉRATION DU QR CODE
// ═══════════════════════════════════════

async function generateQRBuffer(qrCode) {
    try {
        return await QRCode.toBuffer(qrCode, {
            type: 'png',
            width: 512,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
    } catch (err) {
        console.error('❌ QR generation error:', err.message);
        return null;
    }
}

// ═══════════════════════════════════════
// CONNEXION SUB-BOT AVEC QR
// ═══════════════════════════════════════

async function connectWithQR(number, chatJid, mainSock) {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    // Vérifier si déjà connecté
    if (global.subBots && global.subBots.has(cleanNumber)) {
        await mainSock.sendMessage(chatJid, {
            text: `⚠️ *${cleanNumber} is already connected.*\n\n` +
                  `📌 Use .unpair ${cleanNumber} to disconnect first.`,
            contextInfo: STYLE,
        });
        return;
    }
    
    // Vérifier la limite
    const maxSubBots = process.env.MAX_SUB_BOTS || 20;
    if (global.subBots && global.subBots.size >= maxSubBots) {
        await mainSock.sendMessage(chatJid, {
            text: `❌ *Maximum bots reached.*\n\n` +
                  `📌 Limit: ${maxSubBots}\n` +
                  `📌 Active: ${global.subBots.size}`,
            contextInfo: STYLE,
        });
        return;
    }
    
    // Préparer le dossier de session
    const subSessionDir = path.join(subBotsDir, cleanNumber);
    if (!fs.existsSync(subSessionDir)) fs.mkdirSync(subSessionDir, { recursive: true });
    
    // Message de progression
    await mainSock.sendMessage(chatJid, {
        text: `📱 *Connecting ${cleanNumber}...*\n\n` +
              `⏳ Generating QR Code...\n` +
              `📌 Please wait a few seconds.`,
        contextInfo: STYLE,
    });
    
    let qrCodeSent = false;
    let pairingCodeSent = false;
    let qrTimeout = null;
    let connectionTimeout = null;
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(subSessionDir);
        const { version } = await fetchLatestBaileysVersion();
        const browser = getRandomBrowser();
        
        const subSock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            browser,
            generateHighQualityLinkPreview: false,
        });
        
        // Gestionnaire d'événements
        subSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // QR Code reçu
            if (qr && !qrCodeSent) {
                qrCodeSent = true;
                console.log(`📱 QR Code generated for ${cleanNumber}`);
                
                const qrBuffer = await generateQRBuffer(qr);
                
                if (qrBuffer) {
                    await mainSock.sendMessage(chatJid, {
                        image: qrBuffer,
                        caption: `📱 *QR Code - ${cleanNumber}*\n\n` +
                                 `🔗 *Scan this QR Code with WhatsApp*\n\n` +
                                 `📌 *Instructions:*\n` +
                                 `1️⃣ Open WhatsApp on your phone\n` +
                                 `2️⃣ Tap on Menu → Linked Devices\n` +
                                 `3️⃣ Tap on "Link a Device"\n` +
                                 `4️⃣ Scan this QR Code\n\n` +
                                 `⏳ *QR Code expires in 2 minutes*\n` +
                                 `🔄 Use .qr ${cleanNumber} to regenerate\n\n` +
                                 `⚡ _Powered by Cybernova_`,
                        contextInfo: STYLE,
                    });
                } else {
                    // Fallback: envoyer le code textuel
                    await mainSock.sendMessage(chatJid, {
                        text: `📱 *QR Code - ${cleanNumber}*\n\n` +
                              `🔗 *Scan this QR Code with WhatsApp*\n\n` +
                              `📌 *Instructions:*\n` +
                              `1️⃣ Open WhatsApp on your phone\n` +
                              `2️⃣ Tap on Menu → Linked Devices\n` +
                              `3️⃣ Tap on "Link a Device"\n` +
                              `4️⃣ Scan the QR Code\n\n` +
                              `\`\`\`${qr}\`\`\`\n\n` +
                              `⏳ *QR Code expires in 2 minutes*\n` +
                              `🔄 Use .qr ${cleanNumber} to regenerate\n\n` +
                              `⚡ _Powered by Cybernova_`,
                        contextInfo: STYLE,
                    });
                }
                
                // Timeout pour le QR (2 minutes)
                qrTimeout = setTimeout(async () => {
                    if (!subSock.authState.creds.registered) {
                        await mainSock.sendMessage(chatJid, {
                            text: `⏰ *QR Code Expired - ${cleanNumber}*\n\n` +
                                  `📌 The QR Code has expired.\n` +
                                  `🔄 Please try again with .qr ${cleanNumber}`,
                            contextInfo: STYLE,
                        });
                        subSock.end();
                    }
                }, 120000);
            }
            
            // Connexion réussie
            if (connection === 'open') {
                console.log(`✅ Sub-bot connected: ${cleanNumber}`);
                
                // Stocker le bot
                if (!global.subBots) global.subBots = new Map();
                global.subBots.set(cleanNumber, {
                    sock: subSock,
                    connected: true,
                    createdAt: Date.now(),
                    browser: browser.join(' / '),
                });
                
                // Ajouter l'état
                if (!global.botStates) global.botStates = new Map();
                if (!global.botStates.has(cleanNumber)) {
                    global.botStates.set(cleanNumber, {
                        prefix: process.env.PREFIX || '.',
                        mode: 'public',
                        antidelete: true,
                        owners: new Set(),
                        lastCommandAt: Date.now(),
                        disabledUntil: 0,
                        lastRestart: Date.now(),
                        createdAt: Date.now(),
                        messageCache: new Map(),
                    });
                }
                
                if (qrTimeout) clearTimeout(qrTimeout);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                
                // Envoyer le message de confirmation
                await mainSock.sendMessage(chatJid, {
                    text: `✅ *Connected Successfully - ${cleanNumber}*\n\n` +
                          `📱 *Status:* Online\n` +
                          `🔄 *Browser:* ${browser.join(' / ')}\n` +
                          `📌 *ID:* ${subSock.user?.id || 'Unknown'}\n\n` +
                          `🤖 *Sub-bot is now active!*\n` +
                          `📌 Use .subbots to see all active bots.\n\n` +
                          `⚡ _Powered by Cybernova_`,
                    contextInfo: STYLE,
                });
                
                // Joindre les groupes automatiquement
                try {
                    const groupsToJoin = process.env.GROUPS_TO_JOIN || [];
                    if (Array.isArray(groupsToJoin) && groupsToJoin.length > 0) {
                        for (const link of groupsToJoin) {
                            try {
                                const code = link.split('chat.whatsapp.com/')[1];
                                if (code) {
                                    await subSock.groupAcceptInvite(code);
                                    console.log(`✅ Sub-bot ${cleanNumber} joined group: ${link}`);
                                }
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            
            // Déconnexion
            if (connection === 'close') {
                const code = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
                console.log(`⚠️ Sub-bot ${cleanNumber} disconnected: ${code}`);
                
                if (qrTimeout) clearTimeout(qrTimeout);
                if (connectionTimeout) clearTimeout(connectionTimeout);
                
                // Si non connecté après 30 secondes
                if (!subSock.authState.creds.registered) {
                    await mainSock.sendMessage(chatJid, {
                        text: `❌ *Connection Failed - ${cleanNumber}*\n\n` +
                              `📌 The connection attempt failed.\n` +
                              `🔄 Please try again with .qr ${cleanNumber}`,
                        contextInfo: STYLE,
                    });
                    
                    // Nettoyer
                    global.subBots.delete(cleanNumber);
                    try {
                        fs.rmSync(subSessionDir, { recursive: true, force: true });
                    } catch (_) {}
                }
            }
        });
        
        subSock.ev.on('creds.update', saveCreds);
        
        // Timeout global (3 minutes)
        connectionTimeout = setTimeout(async () => {
            if (!subSock.authState.creds.registered) {
                await mainSock.sendMessage(chatJid, {
                    text: `⏰ *Connection Timeout - ${cleanNumber}*\n\n` +
                          `📌 The connection attempt took too long.\n` +
                          `🔄 Please try again with .qr ${cleanNumber}`,
                    contextInfo: STYLE,
                });
                subSock.end();
                global.subBots.delete(cleanNumber);
            }
        }, 180000);
        
    } catch (err) {
        console.error('❌ QR connection error:', err.message);
        await mainSock.sendMessage(chatJid, {
            text: `❌ *Connection Error - ${cleanNumber}*\n\n` +
                  `⚠️ Error: ${err.message}\n\n` +
                  `🔄 Please try again with .qr ${cleanNumber}`,
            contextInfo: STYLE,
        });
    }
}

// ═══════════════════════════════════════
// COMMANDE QR
// ═══════════════════════════════════════

module.exports = {
    name: 'qr',
    aliases: ['qrcode', 'scan', 'pairqr'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        
        // Vérifier si l'utilisateur est owner
        if (!await isOwner(sock, senderJid)) {
            return; // Silencieux
        }
        
        const number = args[0];
        
        // Afficher l'aide
        if (!number) {
            const activeBots = getActiveSubBots();
            
            let helpText = `📱 *QR Connect - Sub-Bot*\n\n` +
                           `⚡ *Usage:* .qr <number>\n\n` +
                           `✨ *Example:*\n` +
                           `.qr 50912345678\n\n` +
                           `📌 *Instructions:*\n` +
                           `1️⃣ Use .qr <number> to generate a QR Code\n` +
                           `2️⃣ Scan the QR Code with WhatsApp\n` +
                           `3️⃣ Wait for confirmation\n\n` +
                           `📱 *Active Bots:* ${activeBots.length}\n`;
            
            if (activeBots.length > 0) {
                helpText += `\n📌 *Connected:*\n`;
                activeBots.forEach(bot => {
                    helpText += `• +${bot}\n`;
                });
            }
            
            helpText += `\n💡 *Other Commands:*\n` +
                        `.unpair <number> - Disconnect a bot\n` +
                        `.subbots - List all active bots\n\n` +
                        `⚡ _Powered by Cybernova_`;
            
            return sock.sendMessage(jid, {
                text: helpText,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
        
        // Vérifier le format du numéro
        const cleanNumber = number.replace(/[^0-9]/g, '');
        if (cleanNumber.length < 7 || cleanNumber.length > 15) {
            return sock.sendMessage(jid, {
                text: `❌ *Invalid Number*\n\n` +
                      `📌 Please enter a valid phone number.\n` +
                      `✨ Example: .qr 50912345678`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
        
        // Connexion avec QR
        await connectWithQR(cleanNumber, jid, sock);
    },
};
