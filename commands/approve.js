'use strict';

module.exports = {
    name: 'approve',
    aliases: ['accept', 'approveall'],
    category: 'admin',

    async execute({ sock, msg, args, jid }) {
        try {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');

            if (!isGroup) {
                await sock.sendMessage(jid, {
                    text: '❌ This command only works in groups.'
                }, { quoted: msg });
                return;
            }

            const groupInfo = await getGroupInfo(sock, jid);

            if (!isAdmin(groupInfo.admins, senderJid)) {
                await sock.sendMessage(jid, {
                    text: '🚫 Only group administrators can approve join requests.'
                }, { quoted: msg });
                return;
            }

            if (!groupInfo.botIsAdmin) {
                await sock.sendMessage(jid, {
                    text: '🤖 Bot needs to be an admin to approve join requests.'
                }, { quoted: msg });
                return;
            }

            try { await sock.sendMessage(jid, { react: { text: '📋', key: msg.key } }); } catch (_) {}

            const pendingRequests = await sock.groupRequestParticipantsList(jid);

            if (!pendingRequests || pendingRequests.length === 0) {
                await sock.sendMessage(jid, {
                    text: '📋 *No Pending Requests*\n\nThere are no pending join requests to approve.'
                }, { quoted: msg });
                return;
            }

            const style = getCybernovaStyle();
            const input = args.join(' ').toLowerCase();

            // ═══════════════════════════════════════
            // APPROVE ALL
            // ═══════════════════════════════════════

            if (input === 'all' || input === '--all') {
                let approved = 0;
                let failed = 0;

                for (const request of pendingRequests) {
                    try {
                        await sock.groupRequestParticipantsUpdate(jid, [request.jid], 'approve');
                        approved++;
                    } catch (err) {
                        failed++;
                    }
                }

                await sock.sendMessage(jid, {
                    text:
`✅ *All Requests Approved*

📊 Total: ${pendingRequests.length}
✅ Approved: ${approved}
❌ Failed: ${failed}`,
                    contextInfo: style
                }, { quoted: msg });

                try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
                return;
            }

            // ═══════════════════════════════════════
            // PARSE NUMBERS
            // ═══════════════════════════════════════

            let numbersToApprove = [];

            if (args.length > 0) {
                const argStr = args.join(' ').replace(/,/g, ' ');
                const parts = argStr.split(' ');

                for (const part of parts) {
                    if (part.includes('-')) {
                        const [start, end] = part.split('-').map(Number);
                        if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
                            for (let i = start; i <= end; i++) {
                                if (i <= pendingRequests.length) {
                                    numbersToApprove.push(i - 1);
                                }
                            }
                        }
                    } else {
                        const num = parseInt(part);
                        if (!isNaN(num) && num > 0 && num <= pendingRequests.length) {
                            numbersToApprove.push(num - 1);
                        }
                    }
                }
            }

            numbersToApprove = [...new Set(numbersToApprove)];

            // ═══════════════════════════════════════
            // SHOW LIST
            // ═══════════════════════════════════════

            if (numbersToApprove.length === 0) {
                let listText =
`📋 *Pending Join Requests*

Total: ${pendingRequests.length}

`;

                pendingRequests.forEach((req, index) => {
                    const mention = `@${req.jid.split('@')[0].split(':')[0]}`;
                    listText += `*${index + 1}.* ${mention}\n`;
                });

                listText +=
`\n📌 *Usage:*
.approve <number(s)>
.approve 1 3 5
.approve 1-5
.approve all`;

                const allMentions = pendingRequests.map(req => req.jid.split('@')[0].split(':')[0] + '@s.whatsapp.net');

                await sock.sendMessage(jid, {
                    text: listText,
                    contextInfo: {
                        mentionedJid: allMentions,
                        ...style
                    }
                }, { quoted: msg });

                try { await sock.sendMessage(jid, { react: { text: '📋', key: msg.key } }); } catch (_) {}
                return;
            }

            // ═══════════════════════════════════════
            // APPROVE SELECTED
            // ═══════════════════════════════════════

            let approved = 0;
            let failed = 0;
            const approvedMentions = [];

            for (const index of numbersToApprove) {
                const request = pendingRequests[index];
                if (!request) continue;

                try {
                    await sock.groupRequestParticipantsUpdate(jid, [request.jid], 'approve');
                    approved++;
                    const mention = `@${request.jid.split('@')[0].split(':')[0]}`;
                    approvedMentions.push(`✅ ${mention}`);
                } catch (err) {
                    failed++;
                }
            }

            const allApprovedMentions = numbersToApprove
                .map(i => pendingRequests[i])
                .filter(Boolean)
                .map(req => req.jid.split('@')[0].split(':')[0] + '@s.whatsapp.net');

            await sock.sendMessage(jid, {
                text:
`✅ *Requests Approved*

📊 Total selected: ${numbersToApprove.length}
✅ Approved: ${approved}
❌ Failed: ${failed}

${approvedMentions.join('\n')}`,
                contextInfo: {
                    mentionedJid: allApprovedMentions,
                    ...style
                }
            }, { quoted: msg });

            try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}

        } catch (err) {
            console.error('❌ Approve command error:', err);
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}
            await sock.sendMessage(jid, {
                text: `❌ Failed to process approvals: ${err.message}`
            }, { quoted: msg });
        }
    }
};

// ═══════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════

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
        if (!metadata?.participants) {
            return { admins: [], botIsAdmin: false };
        }

        const admins = [];
        const botAllIds = getBotAllIds(sock);
        let botIsAdmin = false;

        for (const participant of metadata.participants) {
            const isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
            if (!isAdmin) continue;

            admins.push(participant.id);

            const participantRaw = getRawNumber(participant.id);
            if (botAllIds.includes(participantRaw)) {
                botIsAdmin = true;
            }
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
