// ./commands/edit.js

const axios = require('axios');

// ═══════════════════════════════════════
// STYLE CYBERNOVA
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════

function getMentionedJid(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentioned;
}

function getQuotedSender(msg) {
    try {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) return quotedParticipant;
        }
        return null;
    } catch (_) {
        return null;
    }
}

async function getAvatarUrl(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image');
    } catch (_) {
        return null;
    }
}

function getRawNumber(jid) {
    if (!jid) return '';
    return jid.split('@')[0];
}

// ═══════════════════════════════════════
// APIS DE FALLBACK
// ═══════════════════════════════════════

const EDIT_APIS = [
    {
        name: 'DavidCyril Nanobanana',
        fn: async (imageUrl, prompt) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/nanobanana?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`,
                { timeout: 60000 }
            );
            if (data?.success && data?.result?.image) {
                return data.result.image;
            }
            return null;
        }
    },
    {
        name: 'DavidCyril Nanobanana V2',
        fn: async (imageUrl, prompt) => {
            const { data } = await axios.get(
                `https://apis.davidcyriltech.my.id/nanobanana2?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`,
                { timeout: 60000 }
            );
            if (data?.success && data?.result?.image) {
                return data.result.image;
            }
            return null;
        }
    }
];

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'edit',
    aliases: ['modify', 'imageedit', 'nanobanana'],
    category: 'fun',

    async execute({ sock, msg, args, jid }) {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        let imageUrl = null;
        let prompt = null;
        let targetJid = null;

        // Analyser les arguments
        const fullText = args.join(' ');
        const promptMatch = fullText.match(/^(.*?)(?:\s*\|\s*|\s+--prompt\s+|\s+-p\s+)(.*)$/i);

        if (promptMatch) {
            // Format: .edit <image> | <prompt> ou .edit <image> --prompt <prompt>
            const imagePart = promptMatch[1].trim();
            prompt = promptMatch[2].trim();

            // Vérifier si la première partie est une URL
            if (imagePart.startsWith('http')) {
                imageUrl = imagePart;
                targetJid = 'user';
            } else {
                // Sinon, c'est une mention
                const mentioned = getMentionedJid(msg);
                if (mentioned.length > 0) {
                    targetJid = mentioned[0];
                    imageUrl = await getAvatarUrl(sock, targetJid);
                }
            }
        } else {
            // Pas de prompt explicite, essayer de détecter
            const parts = fullText.split(/\s+/);
            const lastPart = parts[parts.length - 1];
            
            // Vérifier si le dernier argument est une URL (donc c'est le prompt)
            if (parts.length >= 2 && !parts[0].startsWith('http') && !parts[0].startsWith('@')) {
                // Format: .edit <prompt> <image_url>
                const possiblePrompt = parts.slice(0, -1).join(' ');
                const possibleUrl = parts[parts.length - 1];
                if (possibleUrl.startsWith('http')) {
                    imageUrl = possibleUrl;
                    prompt = possiblePrompt;
                    targetJid = 'user';
                }
            }
        }

        // Si pas de prompt, vérifier si un message est cité ou une mention
        if (!imageUrl || !prompt) {
            // Vérifier le message cité
            const quotedSender = getQuotedSender(msg);
            if (quotedSender && !imageUrl) {
                targetJid = quotedSender;
                imageUrl = await getAvatarUrl(sock, targetJid);
            }

            // Vérifier les mentions
            if (!imageUrl) {
                const mentioned = getMentionedJid(msg);
                if (mentioned.length > 0) {
                    targetJid = mentioned[0];
                    imageUrl = await getAvatarUrl(sock, targetJid);
                }
            }

            // Si toujours pas d'image, utiliser l'utilisateur qui commande
            if (!imageUrl) {
                targetJid = senderJid;
                imageUrl = await getAvatarUrl(sock, targetJid);
            }

            // Si toujours pas de prompt, demander
            if (!prompt) {
                return sock.sendMessage(jid, {
                    text: '🎨 *Image Editor*\n\n' +
                          '⚡ *Usage:*\n' +
                          '.edit <image> | <prompt>\n' +
                          '.edit <prompt> <image_url>\n' +
                          '.edit @user | <prompt>\n' +
                          '.edit (reply) | <prompt>\n\n' +
                          '✨ *Examples:*\n' +
                          '.edit https://example.com/image.jpg | make her hair blue\n' +
                          '.edit make her hair blue https://example.com/image.jpg\n' +
                          '.edit @user | make him wear sunglasses\n\n' +
                          '💡 Reply to a message to use that user\'s profile pic.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }
        }

        if (!imageUrl) {
            return sock.sendMessage(jid, {
                text: '❌ *No image found*\n\n' +
                      '💡 Make sure the target has a profile picture.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🎨', key: msg.key } });

            let editedImage = null;
            let usedApi = '';

            // Essayer chaque API
            for (const api of EDIT_APIS) {
                try {
                    console.log(`📤 Trying ${api.name}...`);
                    const result = await api.fn(imageUrl, prompt);
                    if (result) {
                        editedImage = result;
                        usedApi = api.name;
                        console.log(`✅ ${api.name} succeeded`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ ${api.name} failed: ${err.message}`);
                }
            }

            if (!editedImage) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return sock.sendMessage(jid, {
                    text: '❌ *All editing APIs failed*\n\n' +
                          '💡 Try again with a different prompt or image.',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Télécharger l'image modifiée
            const imgResponse = await axios.get(editedImage, {
                responseType: 'arraybuffer',
                timeout: 30000,
            });
            const buffer = Buffer.from(imgResponse.data);

            // Construction du message avec mention
            const mentionJid = targetJid !== 'user' ? targetJid : null;
            const mentionList = mentionJid ? [mentionJid] : [];

            let caption = `🎨 *Image Edited*\n\n`;
            if (mentionJid) {
                caption += `👤 @${getRawNumber(mentionJid)}\n`;
            }
            caption += `📝 *Prompt:* ${prompt}\n` +
                       `🔧 *Source:* ${usedApi}\n\n` +
                       `⚡ _Powered by Cybernova_`;

            await sock.sendMessage(jid, {
                image: buffer,
                caption: caption,
                contextInfo: {
                    mentionedJid: mentionList,
                    ...STYLE,
                },
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ Edit error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: '❌ *Failed to edit image*\n\n' +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Try again with a different prompt or image.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
