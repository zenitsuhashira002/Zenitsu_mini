// ./commands/approve.js

'use strict';

module.exports = {
    name: 'approve',
    aliases: ['accept', 'request'],
    category: 'admin',

    async execute({ sock, msg, args, jid }) {
        try {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');

            if (!isGroup) {
                await sock.sendMessage(jid, { text: '❌ This command only works in groups.' }, { quoted: msg });
                return;
            }

            const groupInfo = await getGroupInfo(sock, jid);

            if (!isAdmin(groupInfo.admins, senderJid)) {
                await sock.sendMessage(jid, { text: '🚫 Only group administrators can approve join requests.' }, { quoted: msg });
                return;
            }

            if (!groupInfo.botIsAdmin) {
                await sock.sendMessage(jid, { text: '🤖 Bot needs to be an admin to approve join requests.' }, { quoted: msg });
                return;
            }

            try { await sock.sendMessage(jid, { react: { text: '📋', key: msg.key } }); } catch (_) {}

            const pendingRequests = await sock.groupRequestParticipantsList(jid);

            if (!pendingRequests || pendingRequests.length === 0) {
                await sock.sendMessage(jid, { text: '📋 *No Pending Requests*\n\nThere are no pending join requests to approve.' }, { quoted: msg });
                return;
            }

            const style = getCybernovaStyle();
            const input = args.join(' ').toLowerCase();

            // APPROVE ALL
            if (input === 'all' || input === '--all') {
                let approved = 0, failed = 0;
                for (const request of pendingRequests) {
                    try {
                        await sock.groupRequestParticipantsUpdate(jid, [request.jid], 'approve');
                        approved++;
                    } catch (err) { failed++; }
                }

                await sock.sendMessage(jid, {
                    text: `✅ *All Requests Approved*\n\n📊 Total: ${pendingRequests.length}\n✅ Approved: ${approved}\n❌ Failed: ${failed}`,
                    contextInfo: style
                }, { quoted: msg });
                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
                return;
            }

            // PARSE NUMBERS
            let numbersToApprove = [];
            if (args.length > 0) {
                const argStr = args.join(' ').replace(/,/g, ' ');
                const parts = argStr.split(' ');
                for (const part of parts) {
                    if (part.includes('-')) {
                        const [start, end] = part.split('-').map(Number);
                        if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
                            for (let i = start; i <= end; i++) if (i <= pendingRequests.length) numbersToApprove.push(i - 1);
                        }
                    } else {
                        const num = parseInt(part);
                        if (!isNaN(num) && num > 0 && num <= pendingRequests.length) numbersToApprove.push(num - 1);
                    }
                }
            }
            numbersToApprove = [...new Set(numbersToApprove)];

            // SHOW LIST
            if (numbersToApprove.length === 0) {
                let listText = `📋 *Pending Join Requests*\n\nTotal: ${pendingRequests.length}\n\n`;
                const mentions = [];

                for (let i = 0; i < pendingRequests.length; i++) {
                    const req = pendingRequests[i];
                    const rawNumber = getRawNumber(req.jid);
                    // Récupération du nom du contact (peut échouer, on garde le numéro)
                    let name = rawNumber;
                    try {
                        name = await sock.getName(req.jid) || rawNumber;
                    } catch (_) {}
                    listText += `${i + 1}. ${name} ( @${rawNumber} )\n`;
                    mentions.push(rawNumber + '@s.whatsapp.net');
                }

                listText += `\n📌 *Usage:*\n.approve <number(s)>\n.approve 1 3 5\n.approve 1-5\n.approve all`;

                await sock.sendMessage(jid, {
                    text: listText,
                    contextInfo: { mentionedJid: mentions, ...style }
                }, { quoted: msg });

                await sock.sendMessage(jid, { react: { text: '📋', key: msg.key } }).catch(() => {});
                return;
            }

            // APPROVE SELECTED
            let approved = 0, failed = 0;
            const approvedMentions = [];

            for (const index of numbersToApprove) {
                const request = pendingRequests[index];
                if (!request) continue;
                try {
                    await sock.groupRequestParticipantsUpdate(jid, [request.jid], 'approve');
                    approved++;
                    const rawNumber = getRawNumber(request.jid);
                    let name = rawNumber;
                    try { name = await sock.getName(request.jid) || rawNumber; } catch (_) {}
                    approvedMentions.push(`✅ ${name} ( @${rawNumber} )`);
                } catch (err) { failed++; }
            }

            const allApprovedMentions = numbersToApprove
                .map(i => pendingRequests[i])
                .filter(Boolean)
                .map(req => getRawNumber(req.jid) + '@s.whatsapp.net');

            await sock.sendMessage(jid, {
                text: `✅ *Requests Approved*\n\n📊 Total selected: ${numbersToApprove.length}\n✅ Approved: ${approved}\n❌ Failed: ${failed}\n\n${approvedMentions.join('\n')}`,
                contextInfo: { mentionedJid: allApprovedMentions, ...style }
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('❌ Approve command error:', err);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(jid, { text: `❌ Failed to process approvals: ${err.message}` }, { quoted: msg });
        }
    }
};

// Fonctions utilitaires (inchangées)
function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

function getBotAllIds(sock) {
    const ids = [];
    if (sock?.user?.lid) ids.push(getRawNumber(sock.user.lid));
    if (sock?.user?.id) ids.push(getRawNumber(sock.user.id));
    return [...new Set(ids)].filter(Boolean);
}

function isAdmin(admins, userJid) {
    const userRaw = getRawNumber(userJid);
    return admins.some(admin => getRawNumber(admin) === userRaw);
}

async function getGroupInfo(sock, groupJid) {
    try {
        const metadata = await sock.groupMetadata(groupJid);
        if (!metadata?.participants) return { admins: [], botIsAdmin: false };

        const admins = [];
        const botAllIds = getBotAllIds(sock);
        let botIsAdmin = false;

        for (const participant of metadata.participants) {
            const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
            if (!isAdmin) continue;
            admins.push(participant.id);
            const participantRaw = getRawNumber(participant.id);
            if (botAllIds.includes(participantRaw)) botIsAdmin = true;
        }

        return { admins, botIsAdmin };
    } catch (error) {
        return { admins: [], botIsAdmin: false };
    }
}

function getCybernovaStyle() {
    return {
        forwardingScore: 350,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363425394543602@newsletter',
            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
            serverMessageId: 202,
        },
    };
                                                                                                                                    }
