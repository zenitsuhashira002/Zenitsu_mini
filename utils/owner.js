// ./utils/owner.js

const main = require('../main.js');

/**
 * Extrait le numéro brut d'un JID
 */
function getRawNumber(jid) {
    if (!jid) return '';
    let num = jid.split('@')[0];
    num = num.split(':')[0];
    return num.trim();
}

/**
 * Détermine la clé du bot (main ou subbot)
 * Utilise getBotKey du main.js si disponible, sinon calcule
 */
function getBotKey(sock) {
    if (main && typeof main.getBotKey === 'function') {
        return main.getBotKey(sock);
    }
    // Fallback
    if (sock.user?.id) {
        return getRawNumber(sock.user.id);
    }
    return 'main';
}

/**
 * Vérifie si un JID est autorisé (owner du bot ou propriétaire principal)
 */
function isOwner(sock, senderJid) {
    if (!senderJid) return false;

    // Utiliser la fonction isBotOwner du main.js si disponible
    if (main && typeof main.isBotOwner === 'function') {
        const botKey = getBotKey(sock);
        return main.isBotOwner(sock, botKey, senderJid);
    }

    // Fallback (comportement original)
    const senderRaw = getRawNumber(senderJid);

    // Bot lui-même
    const botIds = [];
    if (sock.user?.id) botIds.push(getRawNumber(sock.user.id));
    if (sock.user?.lid) botIds.push(getRawNumber(sock.user.lid));
    if (botIds.includes(senderRaw)) return true;

    // Owner configuré
    const ownerNumber = process.env.OWNER_NUMBER || '50935729494';
    if (senderRaw === ownerNumber) return true;

    // Sub-bots (si global.subBots existe)
    if (global.subBots && global.subBots instanceof Map) {
        for (const [subNumber, subData] of global.subBots) {
            if (getRawNumber(subNumber) === senderRaw && subData.sock === sock) {
                return true;
            }
        }
    }

    return false;
}

module.exports = {
    getRawNumber,
    getBotKey,
    isOwner,
};
