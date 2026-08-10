// ./commands/fancy2.js

// ═══════════════════════════════════════
// STYLES — 62 caractères chacun (A-Z, a-z, 0-9)
// ═══════════════════════════════════════

const BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const STYLES = [
    // 0 - Normal (référence)
    BASE,

    // 1 - Bold (gras)
    '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',

    // 2 - Italic (italique)
    '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻1234567890',

    // 3 - Bold Italic (gras italique)
    '𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯1234567890',

    // 4 - Monospace (largeur fixe)
    '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝟶',

    // 5 - Double Struck (doublé)
    '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡𝟘',

    // 6 - Script (écriture cursive)
    '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏1234567890',

    // 7 - Bold Script (cursive grasse)
    '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃1234567890',

    // 8 - Small Caps (petites capitales)
    'ABCDEFGHIJKLMNOPQRSTUVWXYZᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ1234567890',

    // 9 - Black Bubble (cercles noirs)
    '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉➊➋➌➍➎➏➐➑➒⓿',

    // 10 - White Bubble (cercles blancs)
    'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ①②③④⑤⑥⑦⑧⑨⓪',

    // 11 - Fraktur (gothique)
    '𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷1234567890',

    // 12 - Bold Fraktur (gothique gras)
    '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟1234567890',

    // 13 - Sans-serif (sans empattement)
    '𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓1234567890',

    // 14 - Sans-serif Bold (gras sans empattement)
    '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',

    // 15 - Square (carrés)
    '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉1234567890',

    // 16 - Fullwidth (pleine chasse)
    'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ１２３４５６７８９０',

    // 17 - Upside Down (retourné)
    'Z⅄XMΛ∩┴SɹQԀONW˥ʞſIHפℲƎpↃq∀zʎxʍʌnʇsɹbdouɯןʞɾıɥƃɟǝpɔqɐ1234567890',
];

const STYLE_NAMES = [
    'Normal',
    'Bold',
    'Italic',
    'Bold Italic',
    'Monospace',
    'Double Struck',
    'Script',
    'Bold Script',
    'Small Caps',
    'Black Bubble',
    'White Bubble',
    'Fraktur',
    'Bold Fraktur',
    'Sans-serif',
    'Sans-serif Bold',
    'Square',
    'Fullwidth',
    'Upside Down',
];

// ═══════════════════════════════════════
// STYLE POUR LE MENU (Cybernova)
// ═══════════════════════════════════════

const STYLE_WA = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// FONCTION DE CONVERSION
// ═══════════════════════════════════════

function convert(text, styleIndex) {
    const target = STYLES[styleIndex];
    let result = '';

    for (const char of text) {
        const idx = BASE.indexOf(char);
        if (idx >= 0 && idx < target.length) {
            result += target[idx];
        } else {
            result += char;
        }
    }

    return result;
}

// ═══════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════

module.exports = {
    name: 'fancy2',
    aliases: ['fancy', 'font', 'style', 'fancytext'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const input = args.join(' ');

        // Aide
        if (!input) {
            const examples = STYLE_NAMES.map((name, i) => `  *${i + 1}.* ${name}`).join('\n');
            return sock.sendMessage(jid, {
                text:
                    '✨ *Fancy Text Generator*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.fancy2 <text>\n' +
                    '.fancy2 <number>\n\n' +
                    '✨ *Examples:*\n' +
                    '.fancy2 Zenitsu\n' +
                    '.fancy2 5 (copies style #5)\n\n' +
                    '📋 *Available Styles:*\n' + examples + '\n\n' +
                    '💡 First: .fancy2 Zenitsu → see all styles\n' +
                    '💡 Then: .fancy2 3 → copies the text in style #3',
                contextInfo: STYLE_WA,
            }, { quoted: msg });
        }

        // Si c'est un numéro → copier le style sélectionné (UNIQUEMENT le texte)
        const numMatch = input.match(/^(\d+)$/);
        if (numMatch) {
            const styleNum = parseInt(numMatch[1]);
            if (styleNum < 1 || styleNum > STYLES.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ Style must be between 1 and ${STYLES.length}.`,
                    contextInfo: STYLE_WA,
                }, { quoted: msg });
            }

            // Récupérer le dernier texte stocké
            if (!global._lastFancyText) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Use .fancy2 <text> first, then .fancy2 <number>.',
                    contextInfo: STYLE_WA,
                }, { quoted: msg });
            }

            // ⭐ ENVOYER UNIQUEMENT LE TEXTE CONVERTI
            const result = convert(global._lastFancyText, styleNum - 1);
            return sock.sendMessage(jid, {
                text: result,
                // Pas de contexte, pas de mention, juste le texte brut
            }, { quoted: msg });
        }

        // Sinon, c'est un texte → afficher la liste des styles
        global._lastFancyText = input;

        let replyText = `✨ *Fancy Text — "${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"*\n\n`;

        STYLES.forEach((style, i) => {
            const result = convert(input, i);
            replyText += `*${i + 1}.* ${result}\n`;
        });

        replyText += '\n📌 *Reply:* .fancy2 <number>\n💡 Example: .fancy2 3\n⚡ _Zenitsu_';

        await sock.sendMessage(jid, {
            text: replyText,
            contextInfo: STYLE_WA,
        }, { quoted: msg });
    },
};
