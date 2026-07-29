
~/.../testwagit/commands $ cat tag.js

// ./commands/tag.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'tag3',
    aliases: ['mention', 'everyone', 'all'],
    category: 'group',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            await sock.sendMessage(jid, {
                text: '❌ This command only works in groups.'
            }, { quoted: msg });
            return;
        }

        try {
            // Get group metadata
            const groupMetadata = await sock.groupMetadata(jid);
            const participants = groupMetadata.participants;

            // Get group admins
            const admins = participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);

            // Get non-admin participants
            const nonAdmins = participants
                .filter(p => !admins.includes(p.id))
                .map(p => p.id);

            if (nonAdmins.length === 0) {
                await sock.sendMessage(jid, {
                    text: '⚠️ No non-admin members to tag.'
                }, { quoted: msg });
                return;
            }

            // React to show processing
            try { await sock.sendMessage(jid, { react: { text: '📢', key: msg.key } }); } catch (_) {}

            // Extract message to quote
            let quotedMessage = '';
            let quotedMedia = null;
            let mediaType = null;

            // Check if message is a reply
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (quotedMsg) {
                // Extract text
                if (quotedMsg.conversation) {
                    quotedMessage = quotedMsg.conversation;
                } else if (quotedMsg.extendedTextMessage?.text) {
                    quotedMessage = quotedMsg.extendedTextMessage.text;
                } else if (quotedMsg.imageMessage?.caption) {
                    quotedMessage = quotedMsg.imageMessage.caption;
                } else if (quotedMsg.videoMessage?.caption) {
                    quotedMessage = quotedMsg.videoMessage.caption;
                }

                // Extract media using downloadMediaMessage from Baileys
                if (quotedMsg.imageMessage || quotedMsg.videoMessage ||
                    quotedMsg.audioMessage || quotedMsg.documentMessage ||
                    quotedMsg.stickerMessage) {
                    try {
                        // Create a message object for download
                        const mediaMsg = {
                            key: msg.key,
                            message: {
                                [Object.keys(quotedMsg)[0]]: quotedMsg[Object.keys(quotedMsg)[0]]
                            }
                        };

                        quotedMedia = await downloadMediaMessage(mediaMsg, 'buffer', {}, {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        });

                        if (quotedMsg.imageMessage) mediaType = 'image';
                        else if (quotedMsg.videoMessage) mediaType = 'video';
                        else if (quotedMsg.audioMessage) mediaType = 'audio';
                        else if (quotedMsg.documentMessage) mediaType = 'document';
                        else if (quotedMsg.stickerMessage) mediaType = 'sticker';
                    } catch (err) {
                        console.error('Failed to download media:', err);
                    }
                }
            }

            // Get custom message from args
            const customMessage = args.length > 0 ? args.join(' ') : '';

            // Build final message
            let finalMessage = customMessage || quotedMessage ||'‎‎‎';
            if (quotedMessage && customMessage) {
                finalMessage = `${customMessage}\n\n━━━━━━━━━━━━━━\n📌 *Quoted:* ${quotedMessage}`;
            }

            // Create mentions
            const mentions = nonAdmins.map(id => `${id}`);

            // Send message with mentions
            if (quotedMedia && mediaType) {
                // Send with media
                const mediaOptions = {
                    caption: finalMessage,
                    mentions: mentions,
                    contextInfo: {
                        mentionedJid: mentions,
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 202,
                        },
                    }
                };

                if (mediaType === 'image') {
                    await sock.sendMessage(jid, { image: quotedMedia, ...mediaOptions }, { quoted: msg });
                } else if (mediaType === 'video') {
                    await sock.sendMessage(jid, { video: quotedMedia, ...mediaOptions }, { quoted: msg });
                } else if (mediaType === 'audio') {
                    await sock.sendMessage(jid, { audio: quotedMedia, ...mediaOptions }, { quoted: msg });
                } else {
                    // For other types, just send text
                    await sock.sendMessage(jid, {
                        text: finalMessage,
                        mentions: mentions,
                        contextInfo: {
                            mentionedJid: mentions,
                            forwardingScore: 350,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363425394543602@newsletter',
                                newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                                serverMessageId: 202,
                            },
                        }
                    }, { quoted: msg });
                }
            } else {
                // Send text only
                await sock.sendMessage(jid, {
                    text: finalMessage,
                    mentions: mentions,
                    contextInfo: {
                        mentionedJid: mentions,
                        forwardingScore: 350,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 202,
                        },
                    }
                }, { quoted: msg });
            }

            // Success reaction
            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ Tag command error:', err);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            await sock.sendMessage(jid, {
                text: `❌ Failed to tag members: ${err.message}`
            }, { quoted: msg });
        }
    }
};
