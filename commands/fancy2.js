// ./commands/fancy.js

// ═══════════════════════════════════════
// STYLES — Chaque style = un tableau de correspondance
// ═══════════════════════════════════════

const STYLES = [
    // 1 - Normal (référence)
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    
    // 2 - Gras (Bold)
    '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
    
    // 3 - Italique (Italic)
    '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻1234567890',
    
    // 4 - Gras Italique (Bold Italic)
    '𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯1234567890',
    
    // 5 - Monospace
    '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝟶',
    
    // 6 - Double (Double Struck)
    '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡𝟘',
    
    // 7 - Script
    '𝒜𝒵𝒞𝒟𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒜𝒵𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏1234567890',
    
    // 8 - Bold Script
    '𝓐𝓩𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃1234567890',
    
    // 9 - Petit majuscule
    'ABCDEFGHIJKLMNOPQRSTUVWXYZᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ1234567890',
    
    // 10 - Bulles noires
    '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉➊➋➌➍➎➏➐➑➒⓿',
    
    // 11 - Bulles blanches
    'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ①②③④⑤⑥⑦⑧⑨⓪',
    
    // 12 - Fraktur
    '𝔄ℨ𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷1234567890',
    
    // 13 - Bold Fraktur
    '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟1234567890',
    
    // 14 - Sans-serif
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓1234567890',
    
    // 15 - Sans-serif Bold
    '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
    
    // 16 - Carré
    '🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉1234567890',
    
    // 17 - Souligné barré
    'A̲B̲C̲D̲E̲F̲G̲H̲I̲J̲K̲L̲M̲N̲O̲P̲Q̲R̲S̲T̲U̲V̲W̲X̲Y̲Z̲a̲b̲c̲d̲e̲f̲g̲h̲i̲j̲k̲l̲m̲n̲o̲p̲q̲r̲s̲t̲u̲v̲w̲x̲y̲z̲1̲2̲3̲4̲5̲6̲7̲8̲9̲0̲',
    
    // 18 - Barré
    'A̶B̶C̶D̶E̶F̶G̶H̶I̶J̶K̶L̶M̶N̶O̶P̶Q̶R̶S̶T̶U̶V̶W̶X̶Y̶Z̶a̶b̶c̶d̶e̶f̶g̶h̶i̶j̶k̶l̶m̶n̶o̶p̶q̶r̶s̶t̶u̶v̶w̶x̶y̶z̶1̶2̶3̶4̶5̶6̶7̶8̶9̶0̶',
    
    // 19 - Fullwidth
    'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ１２３４５６７８９０',
    
    // 20 - Inversé (Upside down - uniquement minuscules)
    'Z⅄XMΛ∩┴SɹQԀONW˥ʞſIHפℲƎpↃq∀zʎxʍʌnʇsɹbdouɯןʞɾıɥƃɟǝpɔqɐ',
];

const STYLE_NAMES = [
    'Normal', 'Bold', 'Italic', 'Bold Italic', 'Monospace',
    'Double', 'Script', 'Bold Script', 'Small Caps', 'Black Bubble',
    'White Bubble', 'Fraktur', 'Bold Fraktur', 'Sans-serif',
    'Sans-serif Bold', 'Square', 'Underline', 'Strikethrough',
    'Fullwidth', 'Upside Down',
];

// ═══════════════════════════════════════
// CONFIG
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
// CONVERSION
// ═══════════════════════════════════════

function convert(text, styleIndex) {
    const normal = STYLES[0];
    const target = STYLES[styleIndex];
    let result = '';

    for (const char of text) {
        const idx = normal.indexOf(char);
        if (idx >= 0 && idx < target.length) {
            result += target[idx];
        } else {
            result += char;
        }
    }

    return result;
}

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'fancy2',
    aliases: ['font', 'style', 'fancytext'],
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
                    '.fancy2 5 (applies style #5)\n\n' +
                    '📋 *Available Styles:*\n' + examples + '\n\n' +
                    '💡 First: .fancy2 Zenitsu → see all styles\n' +
                    '💡 Then: .fancy2 3 → copy style #3',
                contextInfo: STYLE_WA,
            }, { quoted: msg });
        }

        // Si c'est un numéro → appliquer ce style au dernier texte
        const numMatch = input.match(/^(\d+)$/);
        if (numMatch) {
            const styleNum = parseInt(numMatch[1]);
            if (styleNum < 1 || styleNum > STYLES.length) {
                return sock.sendMessage(jid, {
                    text: `⚠️ Style must be between 1 and ${STYLES.length}.`,
                    contextInfo: STYLE_WA,
                }, { quoted: msg });
            }

            // Récupérer le dernier texte stocké (via variable globale)
            if (!global._lastFancyText) {
                return sock.sendMessage(jid, {
                    text: '⚠️ Use .fancy2 <text> first, then .fancy <number>.',
                    contextInfo: STYLE_WA,
                }, { quoted: msg });
            }

            const result = convert(global._lastFancyText, styleNum - 1);
            const styleName = STYLE_NAMES[styleNum - 1];

            return sock.sendMessage(jid, {
                text:
                    `🎨 *Style:* ${styleName} (#${styleNum})\n` +
                    `📝 *Result:* ${result}\n\n` +
                    '⚡ _Zenitsu_',
                contextInfo: STYLE_WA,
            }, { quoted: msg });
        }

        // Texte → afficher tous les styles
        global._lastFancyText = input;

        let replyText = `✨ *Fancy Text — "${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"*\n\n`;

        STYLES.forEach((style, i) => {
            const result = convert(input, i);
            replyText += `*${i + 1}.* ${result}\n`;
        });

        replyText += '\n📌 *Reply:* .fancy <number>\n💡 Example: .fancy 3\n⚡ _Zenitsu_';

        await sock.sendMessage(jid, {
            text: replyText,
            contextInfo: STYLE_WA,
        }, { quoted: msg });
    },
};
