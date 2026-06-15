module.exports = {
    name: "tagall",
    aliases: ["everyone", "all", "mentionall", "notify"],
    description: "Tag all group members with group profile and hidden mentions",

    async execute({ sock, msg, args, jid, text, config, stats }) {
        const from = jid || msg?.key?.remoteJid;
        
        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        // Vérifier que c'est un groupe
        if (!from.endsWith("@g.us")) {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "❌", key: msg.key }
                });
            }
            return sock.sendMessage(from, { 
                text: "❌ *Erreur*\n\nCette commande fonctionne seulement dans les groupes.\n\n━━━━━━━━━━━━━━━\n_©CybernovA_", 
                quoted: msg 
            });
        }

        try {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "📢", key: msg.key }
                });
            }

            // Récupérer la photo du groupe
            let groupPic = null;
            try {
                groupPic = await sock.profilePictureUrl(from, "image");
            } catch {
                groupPic = null;
            }

            // Récupérer tous les participants
            const group = await sock.groupMetadata(from);
            const participants = group.participants.map(p => p.id);
            
            if (participants.length === 0) {
                return sock.sendMessage(from, {
                    text: "❌ Aucun membre trouvé dans ce groupe."
                }, { quoted: msg });
            }

            // Texte principal avec style Cybernova
            let customText = args.join(" ") || "📢 *MENTION GÉNÉRALE*";
            
            const header = `╭━━━━❲ *TAGALL - MENTION* ❳━━━━╮
┃
┃  ${customText}
┃
┃  📊 *Statistiques :*
┃  • Membres : ${participants.length}
┃  • Groupe : ${group.subject}
┃  • Créé par : ${group.owner?.split('@')[0] || 'Inconnu'}
┃  • Date : ${new Date().toLocaleDateString()}
┃
┃  👥 *Membres mentionnés :*
`;

            // Créer les mentions cachées
            const mentionsList = participants.map((p, i) => {
                const name = p.split('@')[0];
                return `┃  ${i+1}. @${name}`;
            }).join('\n');

            const footer = `
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

⚠️ *Message important*
_Lisez attentivement le message ci-dessus._

━━━━━━━━━━━━━━━
_©CybernovA_`;

            // Combiner le tout
            let fullMessage = header + '\n' + mentionsList + footer;

            // Si le message est trop long (limite WhatsApp ~4096 caractères)
            if (fullMessage.length > 4000) {
                // Version raccourcie
                const shortList = participants.slice(0, 50).map((p, i) => {
                    const name = p.split('@')[0];
                    return `┃  ${i+1}. @${name}`;
                }).join('\n');
                
                const remaining = participants.length - 50;
                const remainingText = remaining > 0 ? `\n┃  ... et ${remaining} autres membres` : '';
                
                fullMessage = header + '\n' + shortList + remainingText + footer;
            }

            // Envoyer le message avec l'image du groupe
            const messageOptions = {
                text: fullMessage,
                mentions: participants,
                contextInfo: {
                    mentionedJid: participants,
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 195
                    }
                }
            };

            // Si une image de groupe existe, l'ajouter
            if (groupPic) {
                await sock.sendMessage(from, {
                    image: { url: groupPic },
                    caption: fullMessage,
                    mentions: participants,
                    contextInfo: {
                        mentionedJid: participants,
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
                await sock.sendMessage(from, messageOptions);
            }

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "✅", key: msg.key }
                });
            }

            // Message de confirmation
            await sock.sendMessage(from, {
                text: `✅ *Tagall terminé !*\n\n👥 ${participants.length} membres ont été mentionnés.\n📢 Message: "${customText.substring(0, 50)}${customText.length > 50 ? '...' : ''}"\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`
            }, { quoted: msg });

        } catch (error) {
            console.error('❌ Erreur tagall:', error);
            
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: "💥", key: msg.key }
                });
            }
            
            let errorMsg = '❌ *Erreur Tagall*\n\n';
            
            if (error.message.includes('not-authorized')) {
                errorMsg += '🚫 *Non autorisé*\n\nLe bot n\'a pas les droits nécessaires.\n\n_Assurez-vous que le bot est admin._';
            } else if (error.message.includes('rate-overlimit')) {
                errorMsg += '⏰ *Limite atteinte*\n\nTrop de mentions en peu de temps.\n\n_Attendez quelques minutes._';
            } else {
                errorMsg += `💥 *Erreur technique*\n\n${error.message}\n\n_Réessayez plus tard._`;
            }
            
            errorMsg += '\n\n━━━━━━━━━━━━━━━\n_©CybernovA_';
            
            await sock.sendMessage(from, {
                text: errorMsg
            }, { quoted: msg });
        }
    }
};
