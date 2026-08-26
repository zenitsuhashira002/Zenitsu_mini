// ./events/quiz.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ═══════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════

const QUIZ_DIR = path.join(process.cwd(), 'database', 'quiz');
const LANGUAGES = {
    fr: 'fr', en: 'en', es: 'es', de: 'de', it: 'it', pt: 'pt',
    ar: 'ar', ru: 'ru', ja: 'ja', zh: 'zh', ht: 'ht', ko: 'ko',
};
const DEFAULT_LANG = 'fr';
const QUESTIONS_PER_QUIZ = 20;
const MAX_PARTICIPANTS = 20;
const MIN_PARTICIPANTS = 2;
const JOIN_WAIT_MS = 60_000;        // 60 secondes pour rejoindre
const QUESTION_TIME_MS = 10_000;    // 10 secondes par question
const INTER_QUESTION_MS = 25_000;   // 25 secondes entre questions
const FAKE_TYPING_MS = 5_000;       // 5 secondes de fake typing

// ═══════════════════════════════════════
// STYLE
// ═══════════════════════════════════════

const STYLE = {
    forwardingScore: 350,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

// ═══════════════════════════════════════
// SESSIONS ACTIVES (par chat)
// ═══════════════════════════════════════

const sessions = new Map();

function getSession(chatJid) {
    return sessions.get(chatJid) || null;
}

function createSession(chatJid, topic, lang, questions) {
    const session = {
        chatJid,
        topic,
        lang,
        questions,
        currentIndex: 0,
        participants: new Set(),        // JIDs des participants ready
        scores: new Map(),              // JID -> points
        answers: new Map(),             // JID -> réponse (pour la question en cours)
        status: 'waiting',              // waiting, playing, finished, cancelled
        questionTimer: null,
        joinTimer: null,
        interQuestionTimer: null,
        fakeTypingTimer: null,
        starter: null,                  // JID du lanceur
    };
    sessions.set(chatJid, session);
    return session;
}

function deleteSession(chatJid) {
    const s = sessions.get(chatJid);
    if (s) {
        clearTimeout(s.questionTimer);
        clearTimeout(s.joinTimer);
        clearTimeout(s.interQuestionTimer);
        clearTimeout(s.fakeTypingTimer);
    }
    sessions.delete(chatJid);
}

// ═══════════════════════════════════════
// TRADUCTION (avec fallback)
// ═══════════════════════════════════════

async function translate(text, targetLang) {
    if (targetLang === DEFAULT_LANG || !text) return text;

    // API Google Translate non officielle
    try {
        const { data } = await axios.get(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
            { timeout: 10000 }
        );
        const translated = data?.[0]?.map(seg => seg[0]).join('');
        if (translated) return translated;
    } catch (_) {}

    // Fallback MyMemory
    try {
        const { data } = await axios.get(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|${targetLang}`,
            { timeout: 10000 }
        );
        if (data?.responseData?.translatedText) {
            return data.responseData.translatedText;
        }
    } catch (_) {}

    return text; // dernier recours : texte original
}

async function translateBatch(texts, targetLang) {
    const results = [];
    for (const t of texts) {
        results.push(await translate(t, targetLang));
        await new Promise(r => setTimeout(r, 200)); // petit délai anti-ban
    }
    return results;
}

// ═══════════════════════════════════════
// CHARGEMENT DES QUESTIONS
// ═══════════════════════════════════════

function loadQuestions(topic) {
    const filePath = path.join(QUIZ_DIR, `${topic.toLowerCase()}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

// Mélange aléatoire (Fisher-Yates)
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ═══════════════════════════════════════
// FONCTIONS D'ENVOI
// ═══════════════════════════════════════

async function sendMessage(sock, jid, text, mentions = []) {
    return sock.sendMessage(jid, {
        text,
        contextInfo: {
            mentionedJid: mentions.length ? mentions : undefined,
            ...STYLE,
        },
    });
}

async function sendTyping(sock, jid) {
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, FAKE_TYPING_MS));
        await sock.sendPresenceUpdate('available', jid);
    } catch (_) {}
}

// ═══════════════════════════════════════
// GESTION DU QUIZ
// ═══════════════════════════════════════

function getOptions(question) {
    // Bonne réponse + 4 fausses choisies aléatoirement parmi les 10
    const fakes = [];
    for (let i = 1; i <= 10; i++) {
        const fake = question[`fa${i}`];
        if (fake) fakes.push(fake);
    }
    const selectedFakes = shuffleArray(fakes).slice(0, 4);
    const all = [question.a, ...selectedFakes];
    return shuffleArray(all);
}

async function sendQuestion(sock, session) {
    const q = session.questions[session.currentIndex];
    const opts = getOptions(q);
    const correctIndex = opts.indexOf(q.a); // 0-based
    const optNumber = i => i + 1;

    // Traduction de la question et des options
    const textToTranslate = [q.q1, ...opts];
    const translated = await translateBatch(textToTranslate, session.lang);
    const questionText = translated[0];
    const optionTexts = translated.slice(1);

    let msg =
        `📝 *Question ${session.currentIndex + 1}/${session.questions.length}*\n\n` +
        `${questionText}\n\n`;

    optionTexts.forEach((opt, i) => {
        msg += `${i + 1}- ${opt}\n`;
    });

    msg += `\n⏳ *10 secondes pour répondre !*`;

    await sendMessage(sock, session.chatJid, msg, [...session.participants]);
    session.correctAnswer = correctIndex + 1; // 1-based
    session.answers.clear();

    // Démarrer le timer de question
    session.questionTimer = setTimeout(async () => {
        await handleQuestionEnd(sock, session);
    }, QUESTION_TIME_MS);
}

async function handleQuestionEnd(sock, session) {
    // Empêcher double appel
    if (!session.questionTimer) return;
    clearTimeout(session.questionTimer);
    session.questionTimer = null;

    const correct = session.correctAnswer;
    const correctResponders = [];
    for (const [jid, ans] of session.answers.entries()) {
        if (ans === correct) correctResponders.push(jid);
    }

    // Tri des bonnes réponses par ordre d'arrivée
    // session.answers est une Map, l'ordre d'insertion est conservé,
    // donc les premiers entrants sont les plus rapides.
    const pointsToAward = [5, 3, 1]; // 1er=5, 2e=3, 3e+=1
    let resultMsg = '';
    const mentions = [];

    for (let i = 0; i < correctResponders.length; i++) {
        const jid = correctResponders[i];
        const pts = i === 0 ? 5 : i === 1 ? 3 : 1;
        session.scores.set(jid, (session.scores.get(jid) || 0) + pts);
        mentions.push(jid);
        resultMsg += `@${jid.split('@')[0].split(':')[0]} => +${pts} ✅\n`;
    }

    resultMsg += `\n*Score:*\n`;
    const sortedScores = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);
    const medals = ['🥇', '🥈', '🥉'];
    sortedScores.forEach(([jid, score], i) => {
        const medal = i < 3 ? medals[i] + ' ' : '';
        resultMsg += `${medal}@${jid.split('@')[0].split(':')[0]} = ${score}\n`;
    });

    await sendMessage(sock, session.chatJid, resultMsg, mentions);

    // Passer à la question suivante après un délai
    session.interQuestionTimer = setTimeout(async () => {
        session.currentIndex++;
        if (session.currentIndex >= session.questions.length) {
            await endQuiz(sock, session);
        } else {
            // Fake typing
            await sendTyping(sock, session.chatJid);
            await sendQuestion(sock, session);
        }
    }, INTER_QUESTION_MS);
}

async function endQuiz(sock, session) {
    session.status = 'finished';
    const sorted = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);
    let finalMsg = '🏁 *Quiz terminé !*\n\n';
    const medals = ['🥇', '🥈', '🥉'];
    sorted.forEach(([jid, score], i) => {
        const medal = i < 3 ? medals[i] + ' ' : '';
        finalMsg += `${medal}@${jid.split('@')[0].split(':')[0]} => ${score}\n`;
    });
    await sendMessage(sock, session.chatJid, finalMsg, [...session.participants]);
    deleteSession(session.chatJid);
}

// ═══════════════════════════════════════
// GESTION DES MESSAGES (réponses, ready, stop)
// ═══════════════════════════════════════

async function quizMessageHandler(sock, update) {
    if (!update.messages) return;
    for (const msg of update.messages) {
        if (!msg.message) continue;
        const chatJid = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (!text) continue;

        const session = getSession(chatJid);
        if (!session) continue;

        const lower = text.trim().toLowerCase();

        // Commandes spéciales pour le lanceur
        if (session.starter === senderJid && lower === 'quiz stop') {
            await sock.sendMessage(chatJid, { text: '🛑 *Quiz annulé.*' });
            deleteSession(chatJid);
            continue;
        }

        if (session.status === 'waiting') {
            if (lower === 'quiz ready') {
                if (!session.participants.has(senderJid) && session.participants.size < MAX_PARTICIPANTS) {
                    session.participants.add(senderJid);
                    session.scores.set(senderJid, 0);
                    await sock.sendMessage(chatJid, {
                        react: { text: '✅', key: msg.key }
                    }).catch(() => {});
                }
            }
            continue;
        }

        if (session.status === 'playing') {
            // Réponse : accepter un numéro (avec ou sans préfixe)
            const prefix = global.PREFIX || '.';
            let clean = text.trim();
            if (clean.startsWith(prefix)) clean = clean.slice(prefix.length).trim();
            const num = parseInt(clean);
            if (!isNaN(num) && num >= 1 && num <= 5) {
                if (!session.answers.has(senderJid)) {
                    session.answers.set(senderJid, num);
                    // Réaction discrète
                    try { await sock.sendMessage(chatJid, { react: { text: '📝', key: msg.key } }); } catch (_) {}
                }
            }
            continue;
        }
    }
}

// ═══════════════════════════════════════
// COMMANDE QUIZ
// ═══════════════════════════════════════

async function quizCommand(sock, msg, args, jid) {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    if (!isGroup) {
        return sock.sendMessage(jid, { text: '❌ Le quiz se joue uniquement en groupe.' });
    }

    // Vérifier qu'il n'y a pas de session active
    if (getSession(jid)) {
        return sock.sendMessage(jid, { text: '⚠️ *Un quiz est déjà en cours dans ce chat.*' });
    }

    // Parser les arguments : [langue] [sujet]
    let lang = DEFAULT_LANG;
    let topic = 'random';
    if (args.length > 0) {
        if (LANGUAGES[args[0].toLowerCase()]) {
            lang = LANGUAGES[args[0].toLowerCase()];
            topic = args.slice(1).join(' ');
        } else {
            topic = args.join(' ');
        }
    }
    topic = topic.toLowerCase().trim() || 'random';

    // Charger les questions
    const questions = loadQuestions(topic);
    if (!questions || questions.length === 0) {
        return sock.sendMessage(jid, {
            text: `❌ *Aucune question trouvée pour le sujet "${topic}".*`,
            contextInfo: STYLE,
        });
    }

    // Créer la session en mode attente
    const session = createSession(jid, topic, lang, shuffleArray(questions).slice(0, QUESTIONS_PER_QUIZ));
    session.starter = senderJid;
    session.participants.add(senderJid);
    session.scores.set(senderJid, 0);

    const topicsAvailable = fs.existsSync(QUIZ_DIR)
        ? fs.readdirSync(QUIZ_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json',''))
        : [];

    await sock.sendMessage(jid, {
        text:
            `🎯 *Quiz lancé !*\n\n` +
            `📚 *Sujet:* ${topic}\n` +
            `🌐 *Langue:* ${lang}\n` +
            `❓ *Questions:* ${session.questions.length}\n` +
            `👥 *Participants requis:* ${MIN_PARTICIPANTS} minimum\n` +
            `\n` +
            `🔹 Envoyez *quiz ready* pour participer.\n` +
            `🔹 Le lanceur peut arrêter avec *quiz stop*.\n` +
            `⏳ *60 secondes pour rejoindre...*`,
        contextInfo: STYLE,
    }, { quoted: msg });

    // Timer pour la fin de la période d'inscription
    session.joinTimer = setTimeout(async () => {
        if (session.participants.size < MIN_PARTICIPANTS) {
            await sock.sendMessage(jid, {
                text: `❌ *Pas assez de participants.*\n` +
                      `Minimum requis: ${MIN_PARTICIPANTS}. Quiz annulé.`,
                contextInfo: STYLE,
            });
            deleteSession(jid);
            return;
        }

        // Démarrer le jeu
        session.status = 'playing';
        await sock.sendMessage(jid, {
            text: `✅ *${session.participants.size} participants !*\n` +
                  `🎮 Début du quiz dans quelques secondes...`,
            contextInfo: STYLE,
        });
        // Fake typing initial
        await sendTyping(sock, jid);
        await sendQuestion(sock, session);
    }, JOIN_WAIT_MS);
}

// ═══════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════

module.exports = {
    event: 'messages.upsert',
    execute: quizMessageHandler,
    name: 'quiz',
    command: quizCommand,
};
