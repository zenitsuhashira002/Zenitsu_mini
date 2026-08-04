// ./commands/getjid.js

// ═══════════════════════════════════════
// STYLE
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
// JID UTILS
// ═══════════════════════════════════════

function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function extractAllJids(sock, msg) {
    const jids = [];

    // JID du bot
    if (sock.user?.id) jids.push({ label: 'Bot ID', jid: sock.user.id });
    if (sock.user?.lid) jids.push({ label: 'Bot LID', jid: sock.user.lid });

    // JID du chat actuel
    if (msg.key?.remoteJid) jids.push({ label: 'Chat JID', jid: msg.key.remoteJid });

    // JID de l'expéditeur
    if (msg.key?.participant) jids.push({ label: 'Sender', jid: msg.key.participant });

    // JID du message quoté
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (quoted?.participant) jids.push({ label: 'Quoted Sender', jid: quoted.participant });
    if (quoted?.stanzaId) jids.push({ label: 'Quoted Msg ID', jid: quoted.stanzaId });

    return jids;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'getjid',
    aliases: ['jid', 'myjid', 'chatid'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const input = args[0];

        // ═══════════════════════════
        // Si un argument est fourni (numéro/lien)
        // ═══════════════════════════
        if (input) {
            let resultJid = '';
            let resultType = '';

            // Lien groupe WhatsApp
            if (input.includes('chat.whatsapp.com/')) {
                const code = input.split('chat.whatsapp.com/')[1]?.split(/[?#]/)[0];
                resultJid = `${code}@g.us`;
                resultType = 'Group';
            }
            // Lien channel
            else if (input.includes('whatsapp.com/channel/')) {
                const code = input.split('whatsapp.com/channel/')[1]?.split(/[?#]/)[0];
                resultJid = `${code}@newsletter`;
                resultType = 'Channel';
            }
            // Lien wa.me
            else if (input.includes('wa.me/')) {
                const num = input.split('wa.me/')[1]?.split(/[/?#]/)[0];
                resultJid = `${num}@s.whatsapp.net`;
                resultType = 'User';
            }
            // Numéro direct
            else {
                const num = input.replace(/[^0-9]/g, '');
                if (num.length >= 7) {
                    resultJid = `${num}@s.whatsapp.net`;
                    resultType = 'User';
                }
            }

            if (resultJid) {
                return sock.sendMessage(jid, {
                    text:
                        '🆔 *JID Info*\n\n' +
                        `📱 *Input:* ${input}@lid\n` +
                        `🏷️ *Type:* ${resultType}\n` +
                        `🆔 *JID:* \`${resultJid}\`\n\n` +
                        '⚡ _Zenitsu_',
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            return sock.sendMessage(jid, {
                text: '❌ Could not parse JID from input.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════════════
        // Pas d'argument → Afficher tous les JIDs
        // ═══════════════════════════
        const allJids = extractAllJids(sock, msg);

        if (allJids.length === 0) {
            return sock.sendMessage(jid, {
                text: '❌ No JID found.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        let text = '🆔 *JID Information*\n\n';

        allJids.forEach(item => {
            text += `📌 *${item.label}:*\n\`${item.jid}\`\n\n`;
        });

        text +=
            '💡 *Usage:*\n' +
            '.getjid 50912345678\n' +
            '.getjid https://chat.whatsapp.com/xxx\n' +
            '.getjid (reply to message)\n\n' +
            '⚡ _Zenitsu_';

        await sock.sendMessage(jid, {
            text: text,
            contextInfo: STYLE,
        }, { quoted: msg });
    },
};
