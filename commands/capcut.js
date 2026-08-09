// ./commands/capcut.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

module.exports = {
    name: 'capcut',
    aliases: ['capcutdl', 'capcutdownload', 'cc'],
    category: 'downloader',

    async execute({ sock, msg, args, jid }) {
        const url = args[0];

        if (!url || !url.includes('capcut.com')) {
            return sock.sendMessage(jid, {
                text: '🎬 *CapCut Downloader*\n\n' +
                      '⚡ *Usage:* .capcut <capcut_url>\n\n' +
                      '✨ *Example:*\n' +
                      '.capcut https://www.capcut.com/template-detail/123456789\n\n' +
                      '📌 Download CapCut templates and videos.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🎬', key: msg.key } });

            const apiUrl = `https://api.siputzx.my.id/api/d/capcut?url=${encodeURIComponent(url)}`;
            console.log(`📤 CapCut API: ${apiUrl}`);

            const { data } = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
                },
            });

            // Vérifier la réponse
            if (!data?.success && !data?.status) {
                throw new Error(data?.message || 'Invalid response from API');
            }

            const result = data.result || data.data || data;
            
            // Extraire les informations
            const title = result.title || result.judul || 'CapCut Template';
            const author = result.author || result.creator || 'Unknown';
            const description = result.description || result.deskripsi || 'No description';
            const likes = result.likes || result.suka || 'N/A';
            const usage = result.usage || result.penggunaan || 'N/A';
            const videoUrl = result.video || result.url || result.download || result.download_url;
            const thumbnail = result.thumbnail || result.thumb || result.image || '';

            if (!videoUrl) {
                throw new Error('No video URL found in response');
            }

            // Télécharger la vidéo
            const videoResponse = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
            });
            const buffer = Buffer.from(videoResponse.data);
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

            // Envoyer la vidéo
            await sock.sendMessage(jid, {
                video: buffer,
                caption: `🎬 *CapCut Template*\n\n` +
                         `📌 *Title:* ${title.slice(0, 80)}${title.length > 80 ? '...' : ''}\n` +
                         `👤 *Author:* ${author}\n` +
                         `📝 *Description:* ${description.slice(0, 100)}${description.length > 100 ? '...' : ''}\n` +
                         `❤️ *Likes:* ${likes}\n` +
                         `📊 *Usage:* ${usage}\n` +
                         `📦 *Size:* ${sizeMB} MB\n\n` +
                         `⚡ _Powered by Zenitsu_`,
                contextInfo: STYLE,
            }, { quoted: msg });

            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('❌ CapCut error:', err.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return sock.sendMessage(jid, {
                text: `❌ *Download Failed*\n\n` +
                      `⚠️ Error: ${err.message}\n\n` +
                      '💡 Make sure the URL is valid and try again.',
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
