// ./commands/tiktok.js

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════
// STYLE CYBERNOVA (comme main.js)
// ═══════════════════════════════════════
const STYLE = {
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 340,
    },
};

// ═══════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════

function formatNumber(num) {
    if (!num) return '0';
    if (typeof num === 'string') {
        num = parseInt(num) || 0;
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDuration(seconds) {
    if (!seconds) return '0s';
    const s = parseInt(seconds);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadFile(url, timeout = 30000) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'video/*,image/*,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.tiktok.com/',
            },
        });
        const buffer = Buffer.from(response.data);
        if (!buffer || buffer.length < 1024) {
            throw new Error('Fichier trop petit ou vide');
        }
        return buffer;
    } catch (error) {
        console.error(`❌ Erreur download ${url}: ${error.message}`);
        throw error;
    }
}

// ═══════════════════════════════════════
// APIs TIKTOK (fallback multiples)
// ═══════════════════════════════════════

const TIKTOK_APIS = [
    {
        name: 'TikWM',
        async fetch(url) {
            const response = await axios.post('https://www.tikwm.com/api/', {
                url: url,
                count: 10,
                cursor: 0,
                web: 1,
                hd: 1,
            }, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            
            const data = response.data?.data;
            if (!data || (!data.play && !data.images)) {
                throw new Error('Format de réponse invalide');
            }
            
            return {
                type: data.images ? 'images' : 'video',
                title: data.title || 'Sans titre',
                author: data.author?.unique_id || 'Inconnu',
                authorName: data.author?.nickname || data.author?.unique_id || 'Inconnu',
                authorAvatar: data.author?.avatar || null,
                likes: data.digg_count || 0,
                comments: data.comment_count || 0,
                shares: data.share_count || 0,
                downloads: data.download_count || 0,
                views: data.play_count || 0,
                duration: data.duration || 0,
                musicTitle: data.music_info?.title || 'Musique inconnue',
                musicAuthor: data.music_info?.author || '',
                musicUrl: data.music || null,
                coverUrl: data.cover || null,
                videoUrl: data.hdplay || data.play || data.wmplay || null,
                images: data.images || [],
                noWatermark: data.hdplay ? true : false,
                size: data.size || 0,
            };
        },
    },
    {
        name: 'DLPanda',
        async fetch(url) {
            const apiUrl = `https://api.dlpanda.com/v1/tiktok?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            
            const data = response.data?.data;
            if (!data || (!data.video && !data.images)) {
                throw new Error('Format de réponse invalide');
            }
            
            return {
                type: data.images ? 'images' : 'video',
                title: data.title || 'Sans titre',
                author: data.author?.username || 'Inconnu',
                authorName: data.author?.name || data.author?.username || 'Inconnu',
                authorAvatar: data.author?.avatar || null,
                likes: data.likes || 0,
                comments: data.comments || 0,
                shares: data.shares || 0,
                downloads: data.downloads || 0,
                views: data.views || 0,
                duration: data.duration || 0,
                musicTitle: data.music?.title || 'Musique inconnue',
                musicAuthor: data.music?.author || '',
                musicUrl: data.music?.url || null,
                coverUrl: data.cover || null,
                videoUrl: data.video || data.video_hd || null,
                images: data.images || [],
                noWatermark: !!data.video_hd,
                size: data.size || 0,
            };
        },
    },
    {
        name: 'TikWM-Alt',
        async fetch(url) {
            const apiUrl = `https://tikwm.com/api/v2/tiktok?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            
            const data = response.data?.data;
            if (!data || (!data.play && !data.images)) {
                throw new Error('Format de réponse invalide');
            }
            
            return {
                type: data.images ? 'images' : 'video',
                title: data.title || 'Sans titre',
                author: data.author?.unique_id || 'Inconnu',
                authorName: data.author?.nickname || data.author?.unique_id || 'Inconnu',
                authorAvatar: data.author?.avatar || null,
                likes: data.digg_count || 0,
                comments: data.comment_count || 0,
                shares: data.share_count || 0,
                downloads: data.download_count || 0,
                views: data.play_count || 0,
                duration: data.duration || 0,
                musicTitle: data.music_info?.title || 'Musique inconnue',
                musicAuthor: data.music_info?.author || '',
                musicUrl: data.music || null,
                coverUrl: data.cover || null,
                videoUrl: data.hdplay || data.play || null,
                images: data.images || [],
                noWatermark: data.hdplay ? true : false,
                size: data.size || 0,
            };
        },
    },
    {
        name: 'Cobalt',
        async fetch(url) {
            const response = await axios.post('https://api.cobalt.tools/api/json', {
                url: url,
                videoQuality: 'max',
                audioFormat: 'mp3',
                filenameStyle: 'basic',
            }, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/json',
                },
            });
            
            const data = response.data;
            if (!data || !data.url) {
                throw new Error('Format de réponse invalide');
            }
            
            return {
                type: 'video',
                title: data.title || 'Sans titre',
                author: 'Inconnu',
                authorName: 'Inconnu',
                authorAvatar: null,
                likes: 0,
                comments: 0,
                shares: 0,
                downloads: 0,
                views: 0,
                duration: 0,
                musicTitle: 'Musique inconnue',
                musicAuthor: '',
                musicUrl: null,
                coverUrl: null,
                videoUrl: data.url || null,
                images: [],
                noWatermark: true,
                size: 0,
            };
        },
    },
];

// ═══════════════════════════════════════
// COMMAND PRINCIPALE
// ═══════════════════════════════════════

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tik', 'tiktokdl'],
    category: 'downloader',
    description: 'Télécharger TikTok sans watermark (vidéo + musique + photos)',

    async execute({ sock, msg, args, jid }) {
        const from = jid || msg?.key?.remoteJid;
        const url = args[0];

        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        // Vérification de l'URL
        if (!url || !url.includes('tiktok.com')) {
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: "❓", key: msg.key } });
            }
            return sock.sendMessage(from, {
                text: '❌ *Usage :*\n`.tiktok [lien TikTok]`\n\n*Exemples :*\n`.tiktok https://vm.tiktok.com/xxxxx`\n`.tiktok https://www.tiktok.com/@user/video/123456`',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Réaction "chargement"
        if (msg?.key) {
            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
        }

        try {
            // Essayer chaque API en fallback
            let tiktokData = null;
            let usedApi = '';

            for (const api of TIKTOK_APIS) {
                try {
                    console.log(`🎯 Tentative API: ${api.name}`);
                    tiktokData = await api.fetch(url);
                    if (tiktokData && (tiktokData.videoUrl || tiktokData.images.length > 0)) {
                        usedApi = api.name;
                        console.log(`✅ API réussie: ${api.name}`);
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ ${api.name} échouée: ${err.message}`);
                }
            }

            if (!tiktokData || (!tiktokData.videoUrl && tiktokData.images.length === 0)) {
                throw new Error('Aucune API TikTok disponible');
            }

            // ═══════════════════════════════════
            // PRÉPARATION DU MESSAGE D'INFOS
            // ═══════════════════════════════════
            const caption = `╭━━━━❲ *TIKTOK DOWNLOAD* ❳━━━━╮
┃
┃  🎵 *Titre :*
┃  ${tiktokData.title?.substring(0, 80) || 'Sans titre'}
┃
┃  👤 *Auteur :*
┃  @${tiktokData.author}
┃
┃  📊 *Statistiques :*
┃  • ❤️ Likes : ${formatNumber(tiktokData.likes)}
┃  • 💬 Commentaires : ${formatNumber(tiktokData.comments)}
┃  • 👁️ Vues : ${formatNumber(tiktokData.views)}
┃  • 🔄 Partages : ${formatNumber(tiktokData.shares)}
┃  • 📥 Téléchargements : ${formatNumber(tiktokData.downloads)}
┃
┃  ⏱️ *Durée :* ${formatDuration(tiktokData.duration)}
┃  🎶 *Musique :*
┃  ${tiktokData.musicTitle?.substring(0, 50) || 'Inconnue'}
┃
┃  📁 *Type :* ${tiktokData.type === 'images' ? 'Photos (Carrousel)' : 'Vidéo'}
┃  💧 *Watermark :* ${tiktokData.noWatermark ? 'Sans' : 'Avec'}
┃  🔧 *API :* ${usedApi}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

_⚡ Qualité maximale • Sans watermark_
_©CybernovA_`;

            // ═══════════════════════════════════
            // ENVOI DE LA MINIATURE AVEC INFOS
            // ═══════════════════════════════════
            if (tiktokData.coverUrl) {
                try {
                    const coverBuffer = await downloadFile(tiktokData.coverUrl, 15000);
                    await sock.sendMessage(from, {
                        image: coverBuffer,
                        caption: caption,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                } catch (err) {
                    console.log('⚠️ Miniature non chargée:', err.message);
                    await sock.sendMessage(from, {
                        text: caption,
                        contextInfo: STYLE,
                    }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(from, {
                    text: caption,
                    contextInfo: STYLE,
                }, { quoted: msg });
            }

            // Délai pour éviter le spam
            await delay(1500);

            // ═══════════════════════════════════
            // GESTION DES PHOTOS (CARROUSEL)
            // ═══════════════════════════════════
            if (tiktokData.type === 'images' && tiktokData.images.length > 0) {
                console.log(`📸 Envoi de ${tiktokData.images.length} photos...`);
                
                // Télécharger toutes les images
                const imageBuffers = [];
                const maxImages = Math.min(tiktokData.images.length, 10); // Limite à 10 photos
                
                for (let i = 0; i < maxImages; i++) {
                    try {
                        console.log(`📥 Téléchargement photo ${i + 1}/${maxImages}`);
                        const imgBuffer = await downloadFile(tiktokData.images[i], 20000);
                        imageBuffers.push(imgBuffer);
                        await delay(500);
                    } catch (err) {
                        console.log(`⚠️ Photo ${i + 1} échouée: ${err.message}`);
                    }
                }

                if (imageBuffers.length > 0) {
                    // Envoyer les photos individuellement
                    for (let i = 0; i < imageBuffers.length; i++) {
                        await sock.sendMessage(from, {
                            image: imageBuffers[i],
                            caption: i === imageBuffers.length - 1 
                                ? `📸 *Photo ${i + 1}/${imageBuffers.length}*\n\n_©CybernovA_` 
                                : `📸 *Photo ${i + 1}/${imageBuffers.length}*`,
                            contextInfo: STYLE,
                        });
                        await delay(800);
                    }
                }
            }
            // ═══════════════════════════════════
            // GESTION VIDÉO
            // ═══════════════════════════════════
            else if (tiktokData.videoUrl) {
                console.log('📹 Envoi de la vidéo...');
                
                // Envoyer la vidéo
                await sock.sendMessage(from, {
                    video: { url: tiktokData.videoUrl },
                    caption: `🎬 *Vidéo TikTok*\n\n👤 @${tiktokData.author}\n🎵 ${tiktokData.musicTitle?.substring(0, 50) || 'Musique'}\n⏱️ ${formatDuration(tiktokData.duration)}\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`,
                    mimetype: 'video/mp4',
                    contextInfo: STYLE,
                });
                
                await delay(1000);
            }

            // ═══════════════════════════════════
            // ENVOI DE LA MUSIQUE SÉPARÉE
            // ═══════════════════════════════════
            if (tiktokData.musicUrl) {
                console.log('🎵 Envoi de la musique...');
                try {
                    const musicBuffer = await downloadFile(tiktokData.musicUrl, 30000);
                    await sock.sendMessage(from, {
                        audio: musicBuffer,
                        mimetype: 'audio/mp4',
                        ptt: false,
                        caption: `🎵 *Musique TikTok*\n\n🎶 Titre : ${tiktokData.musicTitle}\n👤 Artiste : ${tiktokData.musicAuthor || 'Inconnu'}\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`,
                        contextInfo: STYLE,
                    });
                } catch (err) {
                    console.log('⚠️ Musique non envoyée:', err.message);
                }
            }

            // Réaction "succès"
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            }

            // ═══════════════════════════════════
            // MESSAGE DE CONFIRMATION FINAL
            // ═══════════════════════════════════
            await delay(2000);
            const finalMsg = `✅ *Téléchargement terminé*\n\n` +
                `📊 *Résumé :*\n` +
                `• Type : ${tiktokData.type === 'images' ? 'Photos' : 'Vidéo'}\n` +
                `• Durée : ${formatDuration(tiktokData.duration)}\n` +
                `• Taille : ${tiktokData.size ? (tiktokData.size / 1024 / 1024).toFixed(2) + ' MB' : 'Non spécifiée'}\n` +
                `• Vues : ${formatNumber(tiktokData.views)}\n` +
                `• Likes : ${formatNumber(tiktokData.likes)}\n\n` +
                `_©CybernovA_`;

            await sock.sendMessage(from, {
                text: finalMsg,
                contextInfo: STYLE,
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ Erreur TikTok:', err.message);
            
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: "💥", key: msg.key } });
            }
            
            // Message d'erreur stylisé
            let errorMsg = '❌ *Erreur TikTok*\n\n';
            
            if (err.message.includes('timeout')) {
                errorMsg += '⏰ *Délai dépassé*\nLe serveur met trop de temps à répondre.\n\n_Réessaie dans quelques instants._';
            } else if (err.message.includes('404') || err.message.includes('introuvable')) {
                errorMsg += '🔍 *Vidéo non trouvée*\n\nVérifie que le lien est valide et que la vidéo est publique.\n\n_Quelques causes possibles :_\n• Vidéo supprimée\n• Compte privé\n• Lien expiré';
            } else if (err.message.includes('403') || err.message.includes('forbidden')) {
                errorMsg += '🚫 *Accès refusé*\n\nCette vidéo n\'est pas accessible publiquement.';
            } else if (err.message.includes('Aucune API')) {
                errorMsg += '🔧 *Tous les services sont indisponibles*\n\n_Réessaie plus tard._';
            } else {
                errorMsg += `💥 *Erreur technique*\n\n${err.message}\n\n_Réessaie plus tard ou avec un autre lien._`;
            }
            
            errorMsg += '\n\n━━━━━━━━━━━━━━━\n_©CybernovA_';
            
            await sock.sendMessage(from, {
                text: errorMsg,
                contextInfo: STYLE,
            }, { quoted: msg });
        }
    },
};
