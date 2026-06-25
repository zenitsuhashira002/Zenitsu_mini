const axios = require('axios');
const fs = require('fs');
const path = require('path');

// =========================
// 🔥 TTS PROVIDERS (FREE)
// =========================
const TTS_PROVIDERS = [
    {
        id: 1,
        name: 'Google TTS',
        endpoint: 'https://translate.google.com/translate_tts',
        method: 'GET',
        format: (text, lang, gender) => {
            const voice = gender === 'male' ? 'male' : 'female';
            return {
                params: {
                    ie: 'UTF-8',
                    q: text,
                    tl: lang,
                    total: 1,
                    idx: 0,
                    textlen: text.length,
                    client: 'tw-ob',
                    prev: 'input',
                    ttsspeed: 1
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 15000
            };
        }
    },
    {
        id: 2,
        name: 'VoiceRSS',
        endpoint: 'https://api.voicerss.org/',
        method: 'GET',
        format: (text, lang, gender) => {
            const voice = gender === 'male' ? 'Male' : 'Female';
            // VoiceRSS ne nécessite pas de clé API pour les tests
            // Utilise une clé gratuite si disponible
            const apiKey = 'YOUR_API_KEY'; // Remplacer par votre clé si vous en avez une
            return {
                params: {
                    key: apiKey,
                    hl: lang,
                    v: voice,
                    src: text,
                    r: '0',
                    c: 'mp3',
                    f: '44khz_16bit_stereo'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 20000
            };
        }
    },
    {
        id: 3,
        name: 'StreamElements',
        endpoint: 'https://api.streamelements.com/kappa/v2/speech',
        method: 'GET',
        format: (text, lang, gender) => {
            const voice = gender === 'male' ? 'Brian' : 'Joey';
            return {
                params: {
                    voice: voice,
                    text: text
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                responseType: 'arraybuffer',
                timeout: 15000
            };
        }
    },
    {
        id: 4,
        name: 'TTSMP3',
        endpoint: 'https://ttsmp3.com/makemp3_new.php',
        method: 'POST',
        format: (text, lang, gender) => {
            const voiceMap = {
                'en': gender === 'male' ? 'Brian' : 'Emma',
                'fr': gender === 'male' ? 'Antoine' : 'Julie',
                'es': gender === 'male' ? 'Diego' : 'Luisa',
                'de': gender === 'male' ? 'Markus' : 'Anna',
                'it': gender === 'male' ? 'Mario' : 'Gina',
                'pt': gender === 'male' ? 'Carlos' : 'Mariana',
                'ru': gender === 'male' ? 'Dmitri' : 'Olga',
                'ja': gender === 'male' ? 'Kenji' : 'Sakura'
            };
            const voice = voiceMap[lang] || (gender === 'male' ? 'Brian' : 'Emma');
            
            return {
                data: {
                    msg: text,
                    lang: voice,
                    source: 'ttsmp3'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 20000
            };
        },
        parse: (data) => {
            if (data && data.URL) {
                return data.URL;
            }
            return null;
        }
    }
];

// =========================
// 🌍 LANGUAGE CODES
// =========================
const LANGUAGE_CODES = {
    'en': 'English',
    'fr': 'Français',
    'es': 'Español',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'ja': '日本語',
    'zh': '中文',
    'ar': 'العربية',
    'hi': 'हिन्दी',
    'ko': '한국어',
    'nl': 'Nederlands',
    'pl': 'Polski',
    'tr': 'Türkçe'
};

// =========================
🔍 TTS FUNCTION WITH FALLBACK
// =========================
const generateTTS = async (text, lang = 'en', gender = 'female') => {
    // Limiter le texte pour éviter les timeouts
    if (text.length > 200) {
        text = text.substring(0, 197) + '...';
    }

    for (const provider of TTS_PROVIDERS) {
        try {
            console.log(`🎤 Trying ${provider.name}...`);
            
            const config = provider.format(text, lang, gender);
            let responseData;

            if (provider.method === 'GET') {
                const res = await axios.get(provider.endpoint, {
                    params: config.params || {},
                    headers: config.headers || {},
                    responseType: config.responseType || 'arraybuffer',
                    timeout: config.timeout || 15000
                });
                responseData = res.data;
            } else {
                const res = await axios.post(provider.endpoint, config.data || {}, {
                    headers: config.headers || {},
                    responseType: config.responseType || 'arraybuffer',
                    timeout: config.timeout || 15000
                });
                responseData = res.data;
            }

            // Vérifier si c'est un buffer audio
            if (Buffer.isBuffer(responseData) && responseData.length > 1000) {
                return { audio: responseData, provider: provider.name };
            }

            // Vérifier si c'est une URL (TTSMP3)
            if (provider.parse) {
                const url = provider.parse(responseData);
                if (url) {
                    const audioRes = await axios.get(url, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });
                    return { audio: audioRes.data, provider: provider.name };
                }
            }

        } catch (err) {
            console.log(`❌ ${provider.name} failed:`, err.message);
            continue;
        }
    }

    throw new Error('All TTS services are currently unavailable');
};

// =========================
// 📋 GET LANGUAGE LIST
// =========================
const getLanguageList = () => {
    return Object.entries(LANGUAGE_CODES)
        .map(([code, name]) => `┃  ${code} → ${name}`)
        .join('\n');
};

// =========================
// MAIN COMMAND
// =========================
module.exports = {
    name: 'tts',
    aliases: ['say', 'speak', 'voice', 'texttospeech'],
    description: 'Convert text to speech with voice selection',

    async execute({ sock, msg, args, jid, text, config, stats }) {
        const from = jid || msg?.key?.remoteJid;

        if (!from) {
            console.error('❌ JID not available');
            return;
        }

        // =========================
        // 📋 SHOW HELP
        // =========================
        if (args.length === 0 || args[0].toLowerCase() === 'help') {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '📋', key: msg.key }
                });
            }

            const helpMessage = `╭━━━━❲ *TEXT-TO-SPEECH* ❳━━━━╮
┃
┃  🎤 *Usage :*
┃  .tts [options] [text]
┃
┃  ⚙️ *Options :*
┃  • Gender: f|female, m|male
┃  • Language: en, fr, es, de, etc.
┃
┃  💡 *Examples :*
┃  .tts Hello world
┃  .tts f|fr Bonjour tout le monde
┃  .tts m|es Hola mundo
┃  .tts f|de Hallo Welt
┃
┃  🌍 *Available languages :*
${getLanguageList()}
┃
┃  ⚠️ *Default:* Female voice, English
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            return sock.sendMessage(from, {
                text: helpMessage,
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                }
            }, { quoted: msg });
        }

        // =========================
        // 🔍 PARSE ARGUMENTS
        // =========================
        let gender = 'female';
        let lang = 'en';
        let textToSpeak = '';

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            // Vérifier le genre
            if (arg === 'f' || arg === 'female' || arg === 'woman' || arg === 'girl') {
                gender = 'female';
                continue;
            }
            if (arg === 'm' || arg === 'male' || arg === 'man' || arg === 'boy') {
                gender = 'male';
                continue;
            }
            
            // Vérifier la langue
            if (arg.length === 2 && LANGUAGE_CODES[arg]) {
                lang = arg;
                continue;
            }
            
            // Si c'est un format "f|fr" ou "m|en"
            if (arg.includes('|')) {
                const parts = arg.split('|');
                if (parts.length === 2) {
                    const g = parts[0].toLowerCase();
                    const l = parts[1].toLowerCase();
                    
                    if (g === 'f' || g === 'female') gender = 'female';
                    if (g === 'm' || g === 'male') gender = 'male';
                    if (LANGUAGE_CODES[l]) lang = l;
                }
                continue;
            }
            
            // Sinon, c'est du texte
            textToSpeak += (textToSpeak ? ' ' : '') + arg;
        }

        // Si aucun texte, prendre tous les arguments
        if (!textToSpeak) {
            textToSpeak = args.join(' ');
        }

        if (!textToSpeak) {
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '❓', key: msg.key }
                });
            }
            return sock.sendMessage(from, {
                text: '❌ *Missing text*\n\nUsage: .tts [options] [text]\n\nExample: .tts f|fr Bonjour le monde'
            }, { quoted: msg });
        }

        if (msg?.key) {
            await sock.sendMessage(from, {
                react: { text: '🎤', key: msg.key }
            });
        }

        await sock.sendMessage(from, {
            text: `🎤 *Generating speech...*\n\n📝 "${textToSpeak}"\n🌍 Language: ${LANGUAGE_CODES[lang] || lang}\n👤 Gender: ${gender}\n⏳ Please wait...`
        }, { quoted: msg });

        // =========================
        // 🎵 GENERATE TTS
        // =========================
        try {
            const result = await generateTTS(textToSpeak, lang, gender);
            
            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '✅', key: msg.key }
                });
            }

            // Envoyer l'audio comme MP3 (pas voice message)
            await sock.sendMessage(from, {
                audio: result.audio,
                mimetype: 'audio/mpeg',
                ptt: false,  // false = audio normal, true = voice message
                contextInfo: {
                    mentionedJid: [from],
                    forwardingScore: 540,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363425394543602@newsletter',
                        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
                        serverMessageId: 202
                    }
                }
            });

            // Message de confirmation
            const summary = `╭━━━━❲ *TTS GENERATED* ❳━━━━╮
┃
┃  ✅ *Speech generated*
┃
┃  📝 *Text :* "${textToSpeak.substring(0, 50)}${textToSpeak.length > 50 ? '...' : ''}"
┃  🌍 *Language :* ${LANGUAGE_CODES[lang] || lang}
┃  👤 *Voice :* ${gender}
┃  📡 *Source :* ${result.provider}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await sock.sendMessage(from, {
                text: summary
            }, { quoted: msg });

        } catch (error) {
            console.error('❌ TTS Error:', error);

            if (msg?.key) {
                await sock.sendMessage(from, {
                    react: { text: '💥', key: msg.key }
                });
            }

            await sock.sendMessage(from, {
                text: `╭━━━━❲ *TTS ERROR* ❳━━━━╮
┃
┃  ❌ *Unable to generate speech*
┃
┃  📝 *Error :* ${error.message}
┃
┃  💡 *Solutions :*
┃  • Try again in a few minutes
┃  • Use shorter text
┃  • Try .tts help for options
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`
            }, { quoted: msg });
        }
    }
};
