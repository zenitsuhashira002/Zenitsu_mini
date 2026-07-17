// ./commands/bc.js — Version corrigée

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function isOwner(sock, senderJid) {
    if (!senderJid) return false;
    const senderRaw = getRawNumber(senderJid);

    // Bot lui-même (principal ou sub-bot)
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    if (botIds.includes(senderRaw)) return true;

    // Owner configuré
    if (senderRaw === (process.env.OWNER_NUMBER || '50935729494')) return true;

    // Sub-bots enregistrés
    if (global.subBots && global.subBots instanceof Map) {
        for (const [subNumber] of global.subBots) {
            if (getRawNumber(subNumber) === senderRaw) return true;
        }
    }

    return false;
}

async function downloadMedia(mediaMessage, type) {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

module.exports = {
    name: 'bc',
    aliases: ['broadcast', 'sendall'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        // ⭐ Vérification owner CORRIGÉE
        if (!isOwner(sock, senderJid)) {
            return; // Silencieux
        }

        // Récupérer les groupes de CE BOT (pas du owner)
        let groups = [];
        try {
            const allChats = await sock.groupFetchAllParticipating();
            groups = Object.values(allChats).filter(g => g.id.endsWith('@g.us'));
        } catch (err) {
            return sock.sendMessage(jid, { text: '❌ Failed to fetch groups.', contextInfo: STYLE }, { quoted: msg });
        }

        if (groups.length === 0) {
            return sock.sendMessage(jid, { text: '❌ Bot is not in any group.', contextInfo: STYLE }, { quoted: msg });
        }

        // ... (le reste du code est inchangé)
        const subCommand = args[0]?.toLowerCase();

        // ═══════════════════════════
        // SHOW LIST (pas d'arguments numériques)
        // ═══════════════════════════
        if (!subCommand || (isNaN(subCommand) && subCommand !== 'all')) {
            let listText = `📋 *Broadcast — ${groups.length} Groups*\n\n`;
            groups.forEach((g, i) => {
                listText += `*${i + 1}.* ${g.subject}\n   \`${g.id.split('@')[0]}\`\n\n`;
            });
            listText +=
                '📌 *Usage:*\n' +
                '.bc 1 2 3 (reply to message)\n' +
                '.bc all (reply to message)\n' +
                '.bc <text> (send text to all)\n\n' +
                '💡 Reply to a message, then select groups.';

            return sock.sendMessage(jid, {
                text: listText,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════
        // SELECT GROUPS
        // ═══════════════════════════
        let selectedGroups = [];

        if (subCommand === 'all') {
            selectedGroups = groups;
        } else {
            // ⭐ Extraire UNIQUEMENT les numéros (ignorer le texte après les numéros)
            const indices = [];
            for (const arg of args) {
                const num = parseInt(arg);
                if (!isNaN(num) && num > 0 && num <= groups.length) {
                    indices.push(num);
                } else {
                    // Dès qu'on trouve un argument non-numérique, on s'arrête
                    break;
                }
            }
            selectedGroups = indices.map(i => groups[i - 1]);
        }

        if (selectedGroups.length === 0) {
            return sock.sendMessage(jid, {
                text: '⚠️ No valid groups selected.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ⭐ Récupérer le message à envoyer (séparé des numéros)
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // ⭐ Construire le texte SANS les numéros de groupe
        let textContent = '';
        const firstNonNumeric = args.findIndex(a => isNaN(parseInt(a)) && a.toLowerCase() !== 'all');
        if (firstNonNumeric >= 0) {
            textContent = args.slice(firstNonNumeric).join(' ');
        }

        if (!quoted && !textContent) {
            return sock.sendMessage(jid, {
                text: '❌ Reply to a message or type text to broadcast.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Reaction
        try { await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } }); } catch (_) {}

        let sent = 0;
        let failed = 0;

        for (const group of selectedGroups) {
            try {
                if (quoted) {
                    if (quoted.imageMessage) {
                        const buffer = await downloadMedia(quoted.imageMessage, 'image');
                        await sock.sendMessage(group.id, {
                            image: buffer,
                            caption: quoted.imageMessage.caption || textContent || '',
                            contextInfo: STYLE,
                        });
                    } else if (quoted.videoMessage) {
                        const buffer = await downloadMedia(quoted.videoMessage, 'video');
                        await sock.sendMessage(group.id, {
                            video: buffer,
                            caption: quoted.videoMessage.caption || textContent || '',
                            contextInfo: STYLE,
                        });
                    } else if (quoted.audioMessage || quoted.voiceMessage) {
                        const audioMsg = quoted.audioMessage || quoted.voiceMessage;
                        const buffer = await downloadMedia(audioMsg, 'audio');
                        await sock.sendMessage(group.id, {
                            audio: buffer,
                            mimetype: 'audio/mp4',
                            ptt: audioMsg.ptt || false,
                            contextInfo: STYLE,
                        });
                    } else if (quoted.stickerMessage) {
                        const buffer = await downloadMedia(quoted.stickerMessage, 'sticker');
                        await sock.sendMessage(group.id, {
                            sticker: buffer,
                            contextInfo: STYLE,
                        });
                    } else if (quoted.conversation || quoted.extendedTextMessage?.text) {
                        const txt = quoted.conversation || quoted.extendedTextMessage?.text || '';
                        await sock.sendMessage(group.id, {
                            text: txt,
                            contextInfo: STYLE,
                        });
                    } else if (quoted.documentMessage) {
                        const buffer = await downloadMedia(quoted.documentMessage, 'document');
                        await sock.sendMessage(group.id, {
                            document: buffer,
                            mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
                            fileName: quoted.documentMessage.fileName || 'document',
                            contextInfo: STYLE,
                        });
                    } else {
                        await sock.sendMessage(group.id, {
                            text: textContent,
                            contextInfo: STYLE,
                        });
                    }
                } else {
                    await sock.sendMessage(group.id, {
                        text: textContent,
                        contextInfo: STYLE,
                    });
                }

                sent++;
                console.log(`✅ Sent to ${group.subject}`);
            } catch (err) {
                failed++;
                console.log(`❌ Failed ${group.subject}: ${err.message}`);
            }

            await delay(3000);
        }

        await sock.sendMessage(jid, {
            text: `✅ *Broadcast Complete*\n\n📤 *Sent:* ${sent}\n❌ *Failed:* ${failed}\n📊 *Total:* ${selectedGroups.length}\n\n⚡ _Zenitsu_`,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
