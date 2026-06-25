'use strict';

/**
 * ╔══════════════════════════════════════════════════════╗
 * ║              COMMANDE .play — CybernovA             ║
 * ║  Recherche, sélection & envoi audio via WhatsApp    ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Dépendances requises (npm install) :
 *   yt-search          → recherche YouTube sans API key
 *   @distube/ytdl-core → téléchargement audio YouTube (fork maintenu)
 *   axios              → fallback recherche HTTP
 *   fluent-ffmpeg      → conversion audio (optionnel mais recommandé)
 *   ffmpeg-static      → binaire ffmpeg embarqué (optionnel)
 *
 * Flux de la commande :
 *   1. .play <titre>         → recherche + affiche 5 résultats numérotés
 *   2. L'utilisateur répond  → chiffre 1-5 pour sélectionner
 *   3. Téléchargement audio  → via ytdl-core (fallback : URL directe)
 *   4. Envoi du fichier      → audio WhatsApp + métadonnées
 */

const fs    = require('fs');
const path  = require('path');
const os    = require('os');

// ── Imports conditionnels (évite le crash au démarrage si absent) ──
let yts, ytdl, axios, ffmpeg;
try { yts   = require('yt-search');            } catch (_) {}
try { ytdl  = require('@distube/ytdl-core');   } catch (_) {
    try { ytdl = require('ytdl-core');         } catch (_) {}
}
try { axios = require('axios');                } catch (_) {}
try {
    ffmpeg = require('fluent-ffmpeg');
    try {
        const ffmpegStatic = require('ffmpeg-static');
        ffmpeg.setFfmpegPath(ffmpegStatic);
    } catch (_) {}
} catch (_) {}

// ╔══════════════════════════════════════════════════════╗
// ║                  CONFIGURATION                       ║
// ╚══════════════════════════════════════════════════════╝

const CONFIG = {
    RESULTS_LIMIT      : 5,
    TITLE_MAX_LEN      : 42,
    SELECTION_TTL_MS   : 90_000,      // 90 s pour répondre
    DOWNLOAD_TIMEOUT_MS: 60_000,
    MAX_DURATION_SEC   : 600,         // 10 min max
    TMP_DIR            : os.tmpdir(),

    NEWSLETTER: {
        jid            : '120363425394543602@newsletter',
        name           : '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 195
    },

    HTTP_HEADERS: {
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    }
};

// ╔══════════════════════════════════════════════════════╗
// ║              FOURNISSEURS DE RECHERCHE               ║
// ╚══════════════════════════════════════════════════════╝

const SEARCH_PROVIDERS = [

    // ── Provider 1 : yt-search (npm, pas d'API key) ─────────────────
    {
        id         : 1,
        name       : 'YouTube (yt-search)',
        available  : () => !!yts,
        search     : async (query, limit) => {
            const res    = await yts(query);
            const videos = (res.videos ?? []).slice(0, limit);

            return videos.map((v) => ({
                id       : v.videoId,
                title    : v.title,
                url      : v.url,
                thumbnail: v.thumbnail,
                duration : v.timestamp   ?? 'N/A',
                durationSec: v.seconds  ?? 0,
                views    : formatViews(v.views),
                author   : v.author?.name ?? 'Unknown'
            }));
        }
    },

    // ── Provider 2 : YouTube via API publique (no key) ───────────────
    {
        id         : 2,
        name       : 'YouTube (API publique)',
        available  : () => !!axios,
        search     : async (query, limit) => {
            const url = 'https://www.youtube.com/results';
            const res = await axios.get(url, {
                params : { search_query: query },
                headers: CONFIG.HTTP_HEADERS,
                timeout: 12_000
            });

            const html    = res.data ?? '';
            const jsonStr = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s)?.[1];
            if (!jsonStr) return [];

            const data    = JSON.parse(jsonStr);
            const items   = data
                ?.contents
                ?.twoColumnSearchResultsRenderer
                ?.primaryContents
                ?.sectionListRenderer
                ?.contents?.[0]
                ?.itemSectionRenderer
                ?.contents ?? [];

            return items
                .filter((i) => i.videoRenderer)
                .slice(0, limit)
                .map((i) => {
                    const v = i.videoRenderer;
                    const videoId = v.videoId ?? '';
                    const durationText =
                        v.lengthText?.simpleText ?? 'N/A';

                    return {
                        id         : videoId,
                        title      : v.title?.runs?.[0]?.text ?? 'Unknown',
                        url        : `https://www.youtube.com/watch?v=${videoId}`,
                        thumbnail  : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                        duration   : durationText,
                        durationSec: parseDuration(durationText),
                        views      : v.viewCountText?.simpleText ?? 'N/A',
                        author     : v.ownerText?.runs?.[0]?.text ?? 'Unknown'
                    };
                });
        }
    },

    // ── Provider 3 : Invidious (instance publique, JSON propre) ─────
    {
        id         : 3,
        name       : 'Invidious',
        available  : () => !!axios,
        search     : async (query, limit) => {
            // Liste d'instances publiques Invidious — fallback interne
            const INSTANCES = [
                'https://invidious.snopyta.org',
                'https://vid.puffyan.us',
                'https://invidious.kavin.rocks',
                'https://y.com.sb'
            ];

            for (const base of INSTANCES) {
                try {
                    const res = await axios.get(`${base}/api/v1/search`, {
                        params : { q: query, type: 'video', page: 1 },
                        headers: CONFIG.HTTP_HEADERS,
                        timeout: 10_000
                    });

                    const videos = (res.data ?? []).slice(0, limit);
                    if (videos.length === 0) continue;

                    return videos.map((v) => ({
                        id         : v.videoId,
                        title      : v.title,
                        url        : `https://www.youtube.com/watch?v=${v.videoId}`,
                        thumbnail  : `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
                        duration   : formatSeconds(v.lengthSeconds ?? 0),
                        durationSec: v.lengthSeconds ?? 0,
                        views      : formatViews(v.viewCount ?? 0),
                        author     : v.author ?? 'Unknown'
                    }));
                } catch (_) {
                    continue;   // essaie la prochaine instance
                }
            }
            return [];
        }
    }
];

// ╔══════════════════════════════════════════════════════╗
// ║              MOTEUR DE RECHERCHE + FALLBACK          ║
// ╚══════════════════════════════════════════════════════╝

/**
 * Cherche en cascadant les providers jusqu'au premier succès.
 * @param {string} query
 * @param {number} limit
 * @returns {{ results: Array, provider: string }}
 */
const searchMusic = async (query, limit = CONFIG.RESULTS_LIMIT) => {
    for (const provider of SEARCH_PROVIDERS) {
        if (!provider.available()) {
            console.log(`⏭️  ${provider.name} — module absent, skip.`);
            continue;
        }

        try {
            console.log(`🔍 Searching via ${provider.name}…`);
            const results = await provider.search(query, limit);

            if (results && results.length > 0) {
                console.log(`✅ ${provider.name} — ${results.length} résultats.`);
                return { results, provider: provider.name };
            }

            console.log(`⚠️  ${provider.name} — 0 résultat, fallback.`);
        } catch (err) {
            console.warn(`❌ ${provider.name} — ${err.message}`);
        }
    }

    throw new Error('Aucun résultat trouvé sur tous les fournisseurs');
};

// ╔══════════════════════════════════════════════════════╗
// ║              MOTEUR DE TÉLÉCHARGEMENT                ║
// ╚══════════════════════════════════════════════════════╝

/**
 * Télécharge l'audio d'une vidéo YouTube dans un fichier temporaire.
 * Stratégie :
 *   1. @distube/ytdl-core → stream → fichier .mp3 (via ffmpeg si dispo)
 *   2. ytdl-core classique (fallback si distube absent)
 *   3. URL audio directe extraite par ytdl.getInfo (sans stream)
 *
 * @param {{ id: string, title: string, url: string, durationSec: number }} track
 * @returns {Promise<string>} Chemin absolu du fichier temporaire
 */
const downloadAudio = async (track) => {
    if (!ytdl) {
        throw new Error(
            'ytdl-core introuvable. Installez @distube/ytdl-core ou ytdl-core.'
        );
    }

    // Durée maximale
    if (track.durationSec > CONFIG.MAX_DURATION_SEC) {
        throw new Error(
            `Durée trop longue (${formatSeconds(track.durationSec)}). Maximum : ${formatSeconds(CONFIG.MAX_DURATION_SEC)}.`
        );
    }

    const safeTitle = (track.title ?? 'audio')
        .replace(/[^\w\s\-]/g, '')
        .trim()
        .substring(0, 60)
        .replace(/\s+/g, '_');

    const tmpPath = path.join(CONFIG.TMP_DIR, `play_${safeTitle}_${Date.now()}.mp3`);

    // ── Stratégie 1 : stream ytdl + conversion ffmpeg ────────────────
    if (ffmpeg) {
        await new Promise((resolve, reject) => {
            const stream = ytdl(track.url, {
                filter        : 'audioonly',
                quality       : 'highestaudio',
                requestOptions: { headers: CONFIG.HTTP_HEADERS }
            });

            stream.on('error', reject);

            const timer = setTimeout(() => {
                stream.destroy();
                reject(new Error('Téléchargement trop long (timeout).'));
            }, CONFIG.DOWNLOAD_TIMEOUT_MS);

            ffmpeg(stream)
                .audioBitrate(128)
                .toFormat('mp3')
                .on('error', (err) => { clearTimeout(timer); reject(err); })
                .on('end',   ()    => { clearTimeout(timer); resolve();   })
                .save(tmpPath);
        });

        return tmpPath;
    }

    // ── Stratégie 2 : stream ytdl → fichier brut (sans ffmpeg) ──────
    await new Promise((resolve, reject) => {
        const stream  = ytdl(track.url, {
            filter        : 'audioonly',
            quality       : 'highestaudio',
            requestOptions: { headers: CONFIG.HTTP_HEADERS }
        });
        const outPath = tmpPath.replace('.mp3', '.m4a');
        const writer  = fs.createWriteStream(outPath);

        const timer = setTimeout(() => {
            stream.destroy();
            writer.destroy();
            reject(new Error('Téléchargement trop long (timeout).'));
        }, CONFIG.DOWNLOAD_TIMEOUT_MS);

        stream.pipe(writer);
        stream.on('error', (e) => { clearTimeout(timer); reject(e);       });
        writer.on('finish',()  => { clearTimeout(timer); resolve(outPath); });
        writer.on('error', (e) => { clearTimeout(timer); reject(e);       });
    });

    // Renommer pour cohérence (extension .m4a renvoyée)
    const m4aPath = tmpPath.replace('.mp3', '.m4a');
    return m4aPath;
};

// ╔══════════════════════════════════════════════════════╗
// ║                    UTILITAIRES                       ║
// ╚══════════════════════════════════════════════════════╝

const formatViews = (n) => {
    if (!n && n !== 0) return 'N/A';
    const num = typeof n === 'string' ? parseInt(n.replace(/\D/g, '')) : n;
    if (isNaN(num))   return String(n);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M vues';
    if (num >= 1_000)     return (num / 1_000).toFixed(0)     + 'k vues';
    return num + ' vues';
};

const formatSeconds = (sec) => {
    if (!sec) return 'N/A';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const parseDuration = (str) => {
    // "3:45" → 225,  "1:02:03" → 3723
    if (!str || str === 'N/A') return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
};

const truncate = (str, max) =>
    str.length > max ? str.substring(0, max) + '…' : str;

/** Supprime un fichier temporaire en silence. */
const cleanupFile = (filePath) => {
    try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
    catch (_) {}
};

// ╔══════════════════════════════════════════════════════╗
// ║                 ÉTAT DE SÉLECTION                    ║
// ╚══════════════════════════════════════════════════════╝

if (!global.musicSelections) {
    global.musicSelections = new Map();
}

const storeSelection = (key, data) => {
    // Annule un éventuel timer précédent
    const prev = global.musicSelections.get(key);
    if (prev?.timeout) clearTimeout(prev.timeout);

    const timeout = setTimeout(
        () => global.musicSelections.delete(key),
        CONFIG.SELECTION_TTL_MS
    );

    global.musicSelections.set(key, { ...data, timeout });
};

const getSelection = (key) => global.musicSelections.get(key) ?? null;

const clearSelection = (key) => {
    const entry = global.musicSelections.get(key);
    if (entry?.timeout) clearTimeout(entry.timeout);
    global.musicSelections.delete(key);
};

// ╔══════════════════════════════════════════════════════╗
// ║                   MODULE EXPORTÉ                     ║
// ╚══════════════════════════════════════════════════════╝

module.exports = {
    name       : 'play',
    aliases    : ['music', 'song', 'audio', 'yt', 'youtube'],
    description: 'Recherche et envoie de la musique (sélection par numéro)',

    // ── Gestionnaire de sélection numérique ─────────────────────────
    // À brancher sur l'événement messages.upsert de ton bot :
    //
    //   const { handleSelection } = require('./play');
    //   if (handleSelection) await handleSelection({ sock, msg, jid });
    //
    handleSelection: async ({ sock, msg, jid }) => {
        const from   = jid || msg?.key?.remoteJid;
        const sender = msg?.key?.participant || from;
        const body   = (msg?.message?.conversation
                     || msg?.message?.extendedTextMessage?.text
                     || '').trim();

        const num = parseInt(body, 10);
        if (isNaN(num) || num < 1 || num > CONFIG.RESULTS_LIMIT) return false;

        const key   = `${from}_${sender}`;
        const state = getSelection(key);
        if (!state) return false;

        clearSelection(key);

        const track = state.results[num - 1];
        if (!track) return false;

        // Réaction + message d'attente
        if (msg?.key) {
            await sock.sendMessage(from, { react: { text: '⏬', key: msg.key } });
        }

        const waitMsg =
`╭━━━━❲ *TÉLÉCHARGEMENT* ❳━━━━╮
┃
┃  🎵 *${truncate(track.title, 36)}*
┃  👤 ${track.author}
┃  ⏱️ ${track.duration}
┃
┃  ⏳ Préparation en cours…
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(from, { text: waitMsg }, { quoted: msg });

        let tmpFile = null;
        try {
            tmpFile = await downloadAudio(track);

            const audioBuffer = fs.readFileSync(tmpFile);

            // Réaction succès
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            }

            // ── Envoi de l'audio ──────────────────────────────────
            await sock.sendMessage(from, {
                audio : audioBuffer,
                mimetype: 'audio/mpeg',
                ptt   : false,          // false = fichier audio, true = vocal
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid      : CONFIG.NEWSLETTER.jid,
                        newsletterName     : CONFIG.NEWSLETTER.name,
                        serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
                    }
                }
            }, { quoted: msg });

            // ── Message de confirmation ───────────────────────────
            const confirmMsg =
`╭━━━━❲ *MUSIQUE ENVOYÉE* ❳━━━━╮
┃
┃  ✅ *${truncate(track.title, 36)}*
┃  👤 ${track.author}
┃  ⏱️ ${track.duration}
┃  📡 Source : ${state.provider}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await sock.sendMessage(from, {
                text: confirmMsg,
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid      : CONFIG.NEWSLETTER.jid,
                        newsletterName     : CONFIG.NEWSLETTER.name,
                        serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
                    }
                }
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ Erreur téléchargement :', err);

            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: '💥', key: msg.key } });
            }

            const errMsg =
`╭━━━━❲ *ERREUR AUDIO* ❳━━━━╮
┃
┃  ❌ Téléchargement impossible
┃
┃  📝 ${truncate(err.message, 55)}
┃
┃  💡 Solutions :
┃  • Relancez .play <titre>
┃  • Choisissez un autre résultat
┃  • Vérifiez que ytdl-core
┃    est bien installé
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await sock.sendMessage(from, { text: errMsg }, { quoted: msg });

        } finally {
            cleanupFile(tmpFile);
        }

        return true; // indique que la sélection a été traitée
    },

    // ════════════════════════════════════════════════════════════════
    //  EXÉCUTION PRINCIPALE — .play <titre>
    // ════════════════════════════════════════════════════════════════
    async execute({ sock, msg, args, jid }) {
        const from   = jid || msg?.key?.remoteJid;
        const sender = msg?.key?.participant || from;

        if (!from) {
            console.error('❌ JID non disponible');
            return;
        }

        // ── Helpers locaux ───────────────────────────────────────────

        const react = async (emoji) => {
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            }
        };

        const reply = (text, withContext = false) =>
            sock.sendMessage(
                from,
                {
                    text,
                    ...(withContext && {
                        contextInfo: {
                            mentionedJid: [from],
                            forwardingScore: 540,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid      : CONFIG.NEWSLETTER.jid,
                                newsletterName     : CONFIG.NEWSLETTER.name,
                                serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
                            }
                        }
                    })
                },
                { quoted: msg }
            );

        // ════════════════════════════════════════════════════════════
        // 📋  .play help  —  Aide
        // ════════════════════════════════════════════════════════════

        if (args.length === 0 || args[0].toLowerCase() === 'help') {
            await react('📋');

            const helpMessage =
`╭━━━━❲ *MUSIC SEARCH* ❳━━━━╮
┃
┃  🎵 *Usage :*
┃  .play [titre de la musique]
┃
┃  💡 *Exemples :*
┃  .play Bohemian Rhapsody
┃  .play Despacito
┃  .play lofi hip hop
┃
┃  🔄 *Après la recherche :*
┃  Réponds avec un chiffre
┃  (1-${CONFIG.RESULTS_LIMIT}) pour sélectionner
┃  et télécharger la musique
┃
┃  ⏳ *Limite :* ${formatSeconds(CONFIG.MAX_DURATION_SEC)} max
┃  ⚠️  *Pas de clé API requise*
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            return reply(helpMessage, true);
        }

        // ════════════════════════════════════════════════════════════
        // 🔍  RECHERCHE
        // ════════════════════════════════════════════════════════════

        const query = args.join(' ').trim();

        if (!query) {
            await react('❓');
            return reply(
                '❌ *Titre manquant*\n\nUsage : .play [titre]\n\nEx : .play Bohemian Rhapsody'
            );
        }

        await react('🎵');
        await reply(`🔍 Recherche de : *"${query}"*\n⏳ Patientez…`);

        // ════════════════════════════════════════════════════════════
        // 📋  AFFICHAGE DES RÉSULTATS
        // ════════════════════════════════════════════════════════════

        try {
            const { results, provider } = await searchMusic(query);

            if (results.length === 0) {
                await react('❌');
                return reply(
`╭━━━━❲ *AUCUN RÉSULTAT* ❳━━━━╮
┃
┃  ❌ Aucune musique trouvée
┃  pour : *"${truncate(query, 30)}"*
┃
┃  💡 Suggestions :
┃  • Vérifiez l'orthographe
┃  • Essayez d'autres mots-clés
┃  • Ajoutez "official" ou "audio"
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`,
                    true
                );
            }

            await react('✅');

            // ── Construction de la liste numérotée ──────────────────
            const lines = results.map((v, i) => {
                const title = truncate(v.title, CONFIG.TITLE_MAX_LEN);
                return (
                    `┃  *${i + 1}.* ${title}\n` +
                    `┃     👤 ${truncate(v.author, 28)}\n` +
                    `┃     ⏱️ ${v.duration}  |  👁️ ${v.views}`
                );
            }).join('\n┃\n');

            const selectionMessage =
`╭━━━━❲ *RÉSULTATS* ❳━━━━╮
┃
┃  🎵 *"${truncate(query, 30)}"*
┃  📡 Source : ${provider}
┃
${lines}
┃
┃  📌 Réponds avec *1-${results.length}*
┃  pour télécharger la musique
┃  _(${CONFIG.SELECTION_TTL_MS / 1000}s pour répondre)_
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await reply(selectionMessage, true);

            // ── Sauvegarde de l'état de sélection ───────────────────
            const selectionKey = `${from}_${sender}`;
            storeSelection(selectionKey, { results, provider });

        } catch (err) {
            console.error('❌ Erreur play :', err);
            await react('💥');

            await reply(
`╭━━━━❲ *ERROR* ❳━━━━╮
┃
┃  📝 ${truncate(err.message, 50)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`
            );
        }
    }
};
