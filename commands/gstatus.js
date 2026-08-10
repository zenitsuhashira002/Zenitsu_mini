// ./commands/gstatus.js

const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// STYLE
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 550,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 385,
    },
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

async function downloadMedia(sourceMsg, type) {
    const stream = await downloadContentFromMessage(sourceMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function sendStatusToGroup(sock, jid, mediaType, buffer, caption) {
    const contextInfo = {
        isGroupStatus: true,
        statusAttributions: [{ type: 10 }],
        ...STYLE,
    };

    if (mediaType === 'image') {
        await sock.sendMessage(jid, {
            image: buffer,
            caption: caption || '',
            contextInfo: { ...contextInfo, statusSourceType: 'IMAGE' },
        });
    } else if (mediaType === 'video') {
        await sock.sendMessage(jid, {
            video: buffer,
            caption: caption || '',
            contextInfo: { ...contextInfo, statusSourceType: 'VIDEO' },
        });
    } else if (mediaType === 'audio') {
        await sock.sendMessage(jid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            contextInfo: { ...contextInfo, statusSourceType: 'AUDIO' },
        });
    } else {
        await sock.sendMessage(jid, {
            text: caption || '',
            contextInfo: { ...contextInfo, statusSourceType: 'TEXT' },
        });
    }
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'gstatus',
    aliases: ['groupstatus', 'gs'],
    category: 'group',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        const input = args.join(' ');

        // ═══════════════════
        // HELP
        // ═══════════════════

        if (!input) {
            return sock.sendMessage(jid, {
                text:
                    '📢 *Group Status*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.gstatus <text>\n' +
                    '.gstatus (reply to media)\n' +
                    '.gstatus all <text/media>\n' +
                    '.gstatus <group_link> <text/media>\n\n' +
                    '✨ *Examples:*\n' +
                    '.gstatus Hello everyone\n' +
                    '.gstatus all Check this out\n' +
                    '.gstatus https://chat.whatsapp.com/xxx Hello\n\n' +
                    '💡 Sends media or text as group status.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // SEND TO ALL GROUPS
        // ═══════════════════

        if (args[0]?.toLowerCase() === 'all') {
            try { await sock.sendMessage(jid, { react: { text: '⌛', key: msg.key } }); } catch (_) {}

            const inlineText = args.slice(1).join(' ').trim() || null;
            let mediaType = null;
            let sourceMsg = null;
            let caption = inlineText;

            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (msg.message?.imageMessage) {
                sourceMsg = msg.message.imageMessage; mediaType = 'image';
                caption = msg.message.imageMessage?.caption || inlineText || null;
            } else if (msg.message?.videoMessage) {
                sourceMsg = msg.message.videoMessage; mediaType = 'video';
                caption = msg.message.videoMessage?.caption || inlineText || null;
            } else if (msg.message?.audioMessage) {
                sourceMsg = msg.message.audioMessage; mediaType = 'audio';
            } else if (quoted?.imageMessage) {
                sourceMsg = quoted.imageMessage; mediaType = 'image';
                caption = quoted.imageMessage?.caption || inlineText || null;
            } else if (quoted?.videoMessage) {
                sourceMsg = quoted.videoMessage; mediaType = 'video';
                caption = quoted.videoMessage?.caption || inlineText || null;
            } else if (quoted?.audioMessage) {
                sourceMsg = quoted.audioMessage; mediaType = 'audio';
            }

            if (!sourceMsg && !inlineText) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text:
                        '❌ *No media or text!*\n\n' +
                        'Reply to media or type text.\n' +
                        'Example: .gstatus all Hello groups!',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            let buffer = null;
            if (sourceMsg && mediaType) {
                try { buffer = await downloadMedia(sourceMsg, mediaType); }
                catch (e) {
                    try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                    return sock.sendMessage(jid, {
                        text: `❌ Download failed: ${e.message}`,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            }

            const allGroups = await sock.groupFetchAllParticipating();
            const groupJids = Object.keys(allGroups);

            if (!groupJids.length) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: '❌ Bot is not in any groups.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            const results = { success: [], failed: [] };
            for (const gjid of groupJids) {
                try {
                    await sendStatusToGroup(sock, gjid, mediaType, buffer, caption);
                    results.success.push(allGroups[gjid]?.subject || gjid);
                } catch (e) {
                    results.failed.push({ name: allGroups[gjid]?.subject || gjid, error: (e.message || '').slice(0, 60) });
                }
                await new Promise(r => setTimeout(r, 500));
            }

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

            let report = `📊 *GStatus Report*\n\n✅ ${results.success.length}/${groupJids.length}\n❌ ${results.failed.length}/${groupJids.length}`;
            if (results.failed.length) {
                report += '\n\n📋 *Failed:*\n';
                for (const f of results.failed) report += `  • ${f.name}: ${f.error}\n`;
            }
            report += '\n⚡ _Zenitsu_';

            return sock.sendMessage(jid, { text: report, contextInfo: STYLE }, { quoted: msg });
        }

        // ═══════════════════
        // SEND TO SPECIFIC GROUP
        // ═══════════════════

        let targetGroupJid = null;
        let inlineText = null;

        if (isGroup) {
            targetGroupJid = jid;
            inlineText = input || null;
        } else {
            const parts = input.split(/\s+/);
            const firstArg = parts[0] || '';
            inlineText = parts.slice(1).join(' ').trim() || null;

            if (firstArg.includes('chat.whatsapp.com')) {
                const code = firstArg.split('chat.whatsapp.com/')[1]?.split(/[/?#]/)[0];
                if (!code) {
                    return sock.sendMessage(jid, {
                        text: '❌ Invalid group link.',
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
                try {
                    const res = await sock.groupGetInviteInfo(code);
                    targetGroupJid = res?.id || res?.groupId || res?.gid;
                    if (!targetGroupJid) throw new Error('no id');
                } catch (_) {
                    return sock.sendMessage(jid, {
                        text: '❌ Invalid or expired group link.',
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            } else if (firstArg.includes('@g.us')) {
                targetGroupJid = firstArg.trim();
            } else {
                return sock.sendMessage(jid, {
                    text: '❌ Invalid group link or JID.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        try { await sock.sendMessage(jid, { react: { text: '⌛', key: msg.key } }); } catch (_) {}

        let caption = null;
        let sourceMsg = null;
        let mediaType = null;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (msg.message?.imageMessage) {
            sourceMsg = msg.message.imageMessage; mediaType = 'image';
            caption = msg.message.imageMessage?.caption || inlineText || null;
        } else if (msg.message?.videoMessage) {
            sourceMsg = msg.message.videoMessage; mediaType = 'video';
            caption = msg.message.videoMessage?.caption || inlineText || null;
        } else if (msg.message?.audioMessage) {
            sourceMsg = msg.message.audioMessage; mediaType = 'audio';
        } else if (quoted) {
            if (quoted.imageMessage) {
                sourceMsg = quoted.imageMessage; mediaType = 'image';
                caption = quoted.imageMessage?.caption || inlineText || null;
            } else if (quoted.videoMessage) {
                sourceMsg = quoted.videoMessage; mediaType = 'video';
                caption = quoted.videoMessage?.caption || inlineText || null;
            } else if (quoted.audioMessage) {
                sourceMsg = quoted.audioMessage; mediaType = 'audio';
            }
        }

        if (!sourceMsg && !inlineText) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            return sock.sendMessage(jid, {
                text: '❌ Reply to media or add text.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        caption = caption || inlineText || null;

        let buffer = null;
        if (sourceMsg && mediaType) {
            try {
                buffer = await downloadMedia(sourceMsg, mediaType);
            } catch (e) {
                try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
                return sock.sendMessage(jid, {
                    text: `❌ Download failed: ${e.message}`,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        await sendStatusToGroup(sock, targetGroupJid, mediaType, buffer, caption);

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        if (!isGroup) {
            await sock.sendMessage(jid, {
                text: '✅ *Status posted to group!*',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
