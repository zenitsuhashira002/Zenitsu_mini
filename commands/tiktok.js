const axios = require('axios');

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tik', 'tiktokdl'],
    description: 'Télécharger TikTok sans watermark',

    async execute({ sock, msg, args, jid, text, config, stats }) {
        const from = jid || msg?.key?.remoteJid;
        const url = args[0];
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        if (!url || !url.includes('tiktok.com')) {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "❓", key: msg.key }
                });
            }
            return sock.sendMessage(from, {
                text: '❌ *Utilisation:*\n`.tiktok [lien TikTok]`\n\n*Exemple:*\n`.tiktok https://vm.tiktok.com/xxxxx`\n\n━━━━━━━━━━━━━━━\n_©CybernovA_'
            }, { quoted: msg });
        }

        if (msg?.key) {
            await sock.sendMessage(from, {
                react: { text: "⏳", key: msg.key }
            });
        }

        await sock.sendMessage(from, {
            text: '📥 *Téléchargement en cours...*\n\n_Veuillez patienter quelques instants._'
        }, { quoted: msg });

        try {
            // API gratuite TikWM
            const response = await axios.post('https://www.tikwm.com/api/', {
                url: url
            }, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const data = response.data.data;

            if (!data || !data.play) {
                throw new Error('Vidéo introuvable ou privée');
            }

            // Formatage des nombres
            const formatNumber = (num) => {
                if (!num) return '0';
                return num.toLocaleString('fr-FR');
            };

            // Style message transféré Cybernova
            const caption = `╭━━━━❲ *TIKTOK DOWNLOAD* ❳━━━━╮
┃
┃  🎵 *Titre :* 
┃  ${data.title?.substring(0, 60) || 'Sans titre'}
┃
┃  👤 *Auteur :* @${data.author?.unique_id || 'Inconnu'}
┃  ❤️ *Likes :* ${formatNumber(data.digg_count)}
┃  💬 *Commentaires :* ${formatNumber(data.comment_count)}
┃  👁️ *Vues :* ${formatNumber(data.play_count)}
┃  ⏱️ *Durée :* ${data.duration || 0} secondes
┃  🎶 *Musique :* ${data.music_info?.title?.substring(0, 40) || 'Inconnue'}
┃
┃  📊 *Statistiques :*
┃  • Partages : ${formatNumber(data.share_count)}
┃  • Téléchargements : ${formatNumber(data.download_count)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

*✅ Téléchargement réussi !*

_Sans watermark • Qualité HD_

━━━━━━━━━━━━━━━
_©CybernovA_`;

            // Envoyer la miniature avec les infos
            if (data.cover) {
                await sock.sendMessage(from, {
                    image: { url: data.cover },
                    caption: caption,
                    contextInfo: {
                        mentionedJid: [from],
                        forwardingScore: 540,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363425394543602@newsletter',
                            newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                            serverMessageId: 195
                        }
                    }
                });
            } else {
                await sock.sendMessage(from, { text: caption });
            }

            // Petit délai avant l'envoi de la vidéo
            await delay(2000);

            // Choisir la meilleure qualité disponible
            const videoUrl = data.hdplay || data.play || data.wmplay;
            
            if (!videoUrl) {
                throw new Error('Lien vidéo non disponible');
            }

            // Envoyer la vidéo
            await sock.sendMessage(from, {
                video: { url: videoUrl },
                caption: `🎬 *TikTok Video*\n\n👤 @${data.author?.unique_id || 'Inconnu'}\n🎵 ${data.music_info?.title?.substring(0, 30) || 'Musique'}\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`,
                mimetype: 'video/mp4',
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 195
                    }
                }
            });

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: msg.key }
                });
            }

            // Message de confirmation final
            await delay(2000);
            await sock.sendMessage(from, {
                text: `✅ *Téléchargement terminé !*\n\n📁 Fichier envoyé avec succès\n⏱️ Durée: ${data.duration || 0}s\n📊 Poids: ~${(data.size || 0) / 1024 / 1024} MB\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ Erreur TikTok:', err.message);
            
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "💥", key: msg.key }
                });
            }
            
            // Messages d'erreur stylisés
            let errorMsg = '❌ *Erreur TikTok*\n\n';
            
            if (err.message.includes('timeout')) {
                errorMsg += '⏰ *Délai dépassé*\nLe serveur met trop de temps à répondre.\n\n_Réessaie dans quelques instants._';
            } else if (err.message.includes('404') || err.message.includes('introuvable')) {
                errorMsg += '🔍 *Vidéo non trouvée*\n\nVérifie que le lien est valide et que la vidéo est publique.\n\n_Quelques causes possibles :_\n• Vidéo supprimée\n• Compte privé\n• Lien expiré';
            } else if (err.message.includes('403') || err.message.includes('forbidden')) {
                errorMsg += '🚫 *Accès refusé*\n\nCette vidéo n\'est pas accessible publiquement.';
            } else {
                errorMsg += `💥 *Erreur technique*\n\n${err.message}\n\n_Réessaie plus tard ou avec un autre lien._`;
            }
            
            errorMsg += '\n\n━━━━━━━━━━━━━━━\n_©CybernovA_';
            
            await sock.sendMessage(from, {
                text: errorMsg
            }, { quoted: msg });
        }
    }
};
