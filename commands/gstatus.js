// ./commands/gstatus.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 385,
    },
};

// ═══════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════

function formatMessage(msg) {
    return `╭━❲ *GROUP STATUS* ❳━┈⊷\n` +
           `┃\n` +
           `┃ ${msg}\n` +
           `┃\n` +
           `╰━━━━━━━━━━━━━┈⊷\n\n` +
           `⚡ _Powered by Cybernova_`;
}

async function downloadMedia(sourceMsg, type) {
    const stream = await downloadContentFromMessage(sourceMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function sendStatusToGroup(sock, jid, mediaType, buffer, caption) {
    const contextInfo = {
        isGroupStatus: true,
        statusSourceType: mediaType ? mediaType.toUpperCase() : 'TEXT',
        statusAttributions: [{ type: 10 }],
        statusAudienceMetadata: { audienceType: 'CLOSE_FRIENDS' },
        ...STYLE,
    };

    if (mediaType === 'image') {
        await sock.sendMessage(jid, {
            image: buffer,
            caption: caption || '',
            contextInfo,
        });
    } else if (mediaType === 'video') {
        await sock.sendMessage(jid, {
            video: buffer,
            caption: caption || '',
            contextInfo,
        });
    } else if (mediaType === 'audio') {
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            contextInfo,
        });
    } else {
        await sock.sendMessage(jid, {
            text: caption || 'Group Status',
            contextInfo,
        });
    }
}

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'gstatus',
    aliases: ['groupstatus', 'gs'],
    category: 'owner',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        try {
            const bodyStr = (msg.body || '').trim();
            const spaceIdx = bodyStr.indexOf(' ');
            const afterCmd = spaceIdx !== -1 ? bodyStr.slice(spaceIdx + 1).trim() : '';
            const parts = afterCmd.split(/\s+/);
            const firstArg = (parts[0] || '').toLowerCase();

            // ═══════════════════════════════════════
            // MODE ALL - Envoyer à tous les groupes
            // ═══════════════════════════════════════

            if (firstArg === 'all') {
                await sock.sendMessage(jid, { react: { text: '⌛', key: msg.key } });

                const inlineText = parts.slice(1).join(' ').trim() || null;
                let mediaType = null;
                let sourceMsg = null;
                let caption = inlineText;

                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

                // Détection du média
                if (msg.message?.imageMessage) {
                    sourceMsg = msg.message.imageMessage;
                    mediaType = 'image';
                    caption = msg.message.imageMessage?.caption || inlineText || null;
                } else if (msg.message?.videoMessage) {
                    sourceMsg = msg.message.videoMessage;
                    mediaType = 'video';
                    caption = msg.message.videoMessage?.caption || inlineText || null;
                } else if (msg.message?.audioMessage) {
                    sourceMsg = msg.message.audioMessage;
                    mediaType = 'audio';
                } else if (quoted?.imageMessage) {
                    sourceMsg = quoted.imageMessage;
                    mediaType = 'image';
                    caption = quoted.imageMessage?.caption || inlineText || null;
                } else if (quoted?.videoMessage) {
                    sourceMsg = quoted.videoMessage;
                    mediaType = 'video';
                    caption = quoted.videoMessage?.caption || inlineText || null;
                } else if (quoted?.audioMessage) {
                    sourceMsg = quoted.audioMessage;
                    mediaType = 'audio';
                }

                if (!sourceMsg && !inlineText) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage(
                            '❌ *No media or text provided*\n\n' +
                            '📌 *Usage:*\n' +
                            '.gstatus all <text>\n' +
                            '.gstatus all (reply to media)\n\n' +
                            '💡 Reply to media or add text after the command.'
                        ),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                // Télécharger le média
                let buffer = null;
                if (sourceMsg && mediaType) {
                    try {
                        buffer = await downloadMedia(sourceMsg, mediaType);
                    } catch (e) {
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                        return sock.sendMessage(jid, {
                            text: formatMessage(`❌ *Failed to download media*\n\n⚠️ Error: ${e.message}`),
                            contextInfo: STYLE,
                        }, { quoted: msg });
                    }
                }

                // Récupérer tous les groupes
                let allGroups;
                try {
                    allGroups = await sock.groupFetchAllParticipating();
                } catch (e) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage(`❌ *Failed to fetch groups*\n\n⚠️ Error: ${e.message}`),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                const groupJids = Object.keys(allGroups);

                if (!groupJids.length) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage('❌ *Bot is not in any groups*'),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                // Envoyer à tous les groupes
                const results = { success: [], failed: [] };
                for (const gJid of groupJids) {
                    try {
                        await sendStatusToGroup(sock, gJid, mediaType, buffer, caption);
                        results.success.push(allGroups[gJid]?.subject || gJid);
                    } catch (e) {
                        results.failed.push({
                            name: allGroups[gJid]?.subject || gJid,
                            error: (e.message || '').slice(0, 60),
                        });
                    }
                    await new Promise(r => setTimeout(r, 500));
                }

                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

                let report = `╭━❲ *GSTATUS REPORT* ❳━┈⊷\n` +
                            `┃\n` +
                            `┃ ✅ *Success:* ${results.success.length}/${groupJids.length}\n` +
                            `┃ ❌ *Failed:* ${results.failed.length}/${groupJids.length}`;

                if (results.failed.length) {
                    report += `\n┃\n┃ 📋 *Failed Groups:*`;
                    for (const f of results.failed) {
                        report += `\n┃  • ${f.name}: ${f.error}`;
                    }
                }
                report += `\n┃\n╰━━━━━━━━━━━━━┈⊷\n\n⚡ _Powered by Cybernova_`;

                return sock.sendMessage(jid, {
                    text: report,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // ═══════════════════════════════════════
            // MODE NORMAL - Envoyer à un groupe spécifique
            // ═══════════════════════════════════════

            let targetGroupJid = null;
            let inlineText = null;

            if (isGroup) {
                targetGroupJid = jid;
                inlineText = afterCmd || null;
            } else {
                if (!afterCmd) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage(
                            '❌ *No group specified*\n\n' +
                            '📌 *Usage:*\n' +
                            '.gstatus <group_link_or_jid>\n' +
                            '.gstatus all <text>\n\n' +
                            '💡 Provide a group link, JID, or use "all" for all groups.'
                        ),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }

                const p = parts;
                const input = p[0];
                const rest = p.slice(1).join(' ').trim();

                // Lien WhatsApp
                if (input.includes('chat.whatsapp.com')) {
                    let code;
                    try {
                        const url = new URL(input);
                        code = url.pathname.replace(/^\/+/, '');
                    } catch {
                        code = input.split('/').pop();
                    }
                    try {
                        const res = await sock.groupGetInviteInfo(code);
                        targetGroupJid = res?.id || res?.groupId || res?.gid;
                        if (!targetGroupJid) throw new Error('No group ID found');
                    } catch {
                        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                        return sock.sendMessage(jid, {
                            text: formatMessage('❌ *Invalid or expired group link*'),
                            contextInfo: STYLE,
                        }, { quoted: msg });
                    }
                } else if (input.includes('@g.us')) {
                    targetGroupJid = input.trim();
                } else {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage('❌ *Invalid group link or JID*'),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
                inlineText = rest || null;
            }

            await sock.sendMessage(jid, { react: { text: '⌛', key: msg.key } });

            let caption = null;
            let sourceMsg = null;
            let mediaType = null;

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            // Détection du média
            if (msg.message?.imageMessage) {
                sourceMsg = msg.message.imageMessage;
                mediaType = 'image';
                caption = msg.message.imageMessage?.caption || inlineText || null;
            } else if (msg.message?.videoMessage) {
                sourceMsg = msg.message.videoMessage;
                mediaType = 'video';
                caption = msg.message.videoMessage?.caption || inlineText || null;
            } else if (msg.message?.audioMessage) {
                sourceMsg = msg.message.audioMessage;
                mediaType = 'audio';
            } else if (quoted) {
                if (quoted.imageMessage) {
                    sourceMsg = quoted.imageMessage;
                    mediaType = 'image';
                    caption = quoted.imageMessage?.caption || inlineText || null;
                } else if (quoted.videoMessage) {
                    sourceMsg = quoted.videoMessage;
                    mediaType = 'video';
                    caption = quoted.videoMessage?.caption || inlineText || null;
                } else if (quoted.audioMessage) {
                    sourceMsg = quoted.audioMessage;
                    mediaType = 'audio';
                }
            }

            if (!sourceMsg && !inlineText) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: formatMessage('❌ *No media or text provided*\n\n💡 Reply to media or add text after the command.'),
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            caption = caption || inlineText || null;

            let buffer = null;
            if (sourceMsg && mediaType) {
                try {
                    buffer = await downloadMedia(sourceMsg, mediaType);
                } catch (e) {
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                    return sock.sendMessage(jid, {
                        text: formatMessage(`❌ *Failed to download media*\n\n⚠️ Error: ${e.message}`),
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            }

            // Envoyer le status
            await sendStatusToGroup(sock, targetGroupJid, mediaType, buffer, caption);

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

            if (!isGroup) {
                await sock.sendMessage(jid, {
                    text: formatMessage('✅ *Status posted successfully!*'),
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

        } catch (error) {
            console.error('❌ GStatus Error:', error);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, {
                text: formatMessage(`❌ *Error*\n\n⚠️ ${error.message}`),
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
