'use strict';

const axios = require('axios');

// ╔══════════════════════════════════════════════════╗
// ║           CONFIGURATION GLOBALE                  ║
// ╚══════════════════════════════════════════════════╝

const CONFIG = {
    MAX_RESPONSE_LENGTH : 4000,
    MAX_PROMPT_PREVIEW  : 100,
    DEFAULT_TIMEOUT     : 15000,
    RETRY_DELAY_MS      : 500,
    MAX_RETRIES         : 2,

    NEWSLETTER: {
        jid             : '120363425394543602@newsletter',
        name            : '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId : 195
    },

    HEADERS: {
        'Content-Type' : 'application/json',
        'User-Agent'   : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

// ╔══════════════════════════════════════════════════╗
// ║           FOURNISSEURS D'IA GRATUITS             ║
// ╚══════════════════════════════════════════════════╝

const AI_PROVIDERS = [
    {
        id          : 1,
        name        : 'Popcat',
        description : 'Fast & reliable chatbot',
        endpoint    : 'https://api.popcat.xyz/chatbot',
        method      : 'GET',
        timeout     : 10000,
        format      : (prompt) => ({
            params: {
                msg     : prompt,
                owner   : 'Zenitsu',
                botname : 'Assistant'
            }
        }),
        parse: (data) =>
            data?.response
            || data?.message
            || null
    },
    {
        id          : 2,
        name        : 'Petrified',
        description : 'Free GPT-like API',
        endpoint    : 'https://ai.petrified.workers.dev/gpt',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                question : prompt,
                context  : 'You are a helpful assistant'
            }
        }),
        parse: (data) =>
            data?.response
            || data?.message
            || data?.reply
            || null
    },
    {
        id          : 3,
        name        : 'Blowfish',
        description : 'Free AI chat API',
        endpoint    : 'https://blowfish.workers.dev/api/chat',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                message : prompt,
                model   : 'gpt-3.5-turbo'
            }
        }),
        parse: (data) =>
            data?.response
            || data?.message
            || data?.text
            || null
    },
    {
        id          : 4,
        name        : 'Lumina',
        description : 'Free AI generation',
        endpoint    : 'https://lumina.workers.dev/ai',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                prompt     : prompt,
                max_tokens : 200
            }
        }),
        parse: (data) =>
            data?.response
            || data?.output
            || data?.text
            || null
    },
    {
        id          : 5,
        name        : 'Kobold',
        description : 'Free text generation',
        endpoint    : 'https://kobold.workers.dev/generate',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                prompt     : prompt,
                max_length : 150
            }
        }),
        parse: (data) =>
            data?.response
            || data?.generated_text
            || data?.text
            || null
    },
    {
        id          : 6,
        name        : 'Simsimi',
        description : 'Simple chatbot',
        endpoint    : 'https://api.simsimi.vn/v1/simtalk',
        method      : 'GET',
        timeout     : 10000,
        format      : (prompt) => ({
            params: {
                text : prompt,
                lc   : 'en'
            }
        }),
        parse: (data) =>
            data?.message
            || data?.response
            || null
    },
    {
        id          : 7,
        name        : 'Blackbox',
        description : 'Free AI assistant',
        endpoint    : 'https://blackbox.workers.dev/api/chat',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                query : prompt,
                model : 'blackbox'
            }
        }),
        parse: (data) =>
            data?.response
            || data?.answer
            || data?.message
            || null
    },
    {
        id          : 8,
        name        : 'G4F',
        description : 'GPT4Free API',
        endpoint    : 'https://g4f.workers.dev/api/v1/chat',
        method      : 'POST',
        timeout     : 20000,
        format      : (prompt) => ({
            data: {
                messages : [{ role: 'user', content: prompt }],
                model    : 'gpt-3.5-turbo'
            }
        }),
        parse: (data) =>
            data?.response
            || data?.choices?.[0]?.message?.content
            || data?.message
            || null
    },
    {
        id          : 9,
        name        : 'DeepSeek',
        description : 'Free AI chat',
        endpoint    : 'https://deepseek.workers.dev/api/chat',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                message     : prompt,
                temperature : 0.7
            }
        }),
        parse: (data) =>
            data?.response
            || data?.message
            || data?.text
            || null
    },
    {
        id          : 10,
        name        : 'Mistral',
        description : 'Free Mistral API',
        endpoint    : 'https://mistral.workers.dev/api/generate',
        method      : 'POST',
        timeout     : 15000,
        format      : (prompt) => ({
            data: {
                prompt     : prompt,
                max_tokens : 200
            }
        }),
        parse: (data) =>
            data?.response
            || data?.text
            || data?.generated
            || null
    }
];

// ╔══════════════════════════════════════════════════╗
// ║           UTILITAIRES INTERNES                   ║
// ╚══════════════════════════════════════════════════╝

/**
 * Pause asynchrone.
 * @param {number} ms - Durée en millisecondes
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Construit le bloc contextInfo standardisé pour les messages formatés.
 * @param {string} from - JID de l'expéditeur
 */
const buildContextInfo = (from) => ({
    mentionedJid : [from],
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid      : CONFIG.NEWSLETTER.jid,
        newsletterName     : CONFIG.NEWSLETTER.name,
        serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
    }
});

/**
 * Génère la liste formatée des fournisseurs disponibles.
 */
const getProviderList = () =>
    AI_PROVIDERS
        .map((p) => `┃  ${p.id}. ${p.name}\n┃     ${p.description}`)
        .join('\n');

/**
 * Effectue une requête vers un fournisseur donné avec retry automatique.
 * @param {Object} provider  - Objet fournisseur
 * @param {string} prompt    - Prompt utilisateur
 * @param {number} attempt   - Numéro de tentative courante
 */
const callProvider = async (provider, prompt, attempt = 1) => {
    const config = provider.format(prompt);

    const axiosOptions = {
        timeout : provider.timeout ?? CONFIG.DEFAULT_TIMEOUT,
        headers : CONFIG.HEADERS
    };

    let responseData;

    if (provider.method === 'GET') {
        const res = await axios.get(provider.endpoint, {
            ...axiosOptions,
            params: config.params ?? {}
        });
        responseData = res.data;
    } else {
        const res = await axios.post(
            provider.endpoint,
            config.data ?? {},
            axiosOptions
        );
        responseData = res.data;
    }

    const parsed = provider.parse(responseData);

    if (parsed && typeof parsed === 'string' && parsed.trim().length > 0) {
        return parsed.trim();
    }

    throw new Error(`Empty or invalid response from ${provider.name}`);
};

// ╔══════════════════════════════════════════════════╗
// ║       MOTEUR DE FALLBACK — APPEL PAR ID         ║
// ╚══════════════════════════════════════════════════╝

/**
 * Interroge un fournisseur en priorité, puis bascule automatiquement
 * sur les autres en cas d'échec (fallback ordonné).
 *
 * Ordre de résolution :
 *   1. Fournisseur ciblé par ID (avec retry interne)
 *   2. Fournisseurs suivants dans la liste (ordre naturel)
 *   3. Fournisseurs précédents dans la liste (dernier recours)
 *
 * @param {string}      prompt      - Texte de la question
 * @param {number|null} selectedId  - ID du fournisseur souhaité (optionnel)
 * @returns {{ response: string, provider: string, usedFallback: boolean }}
 */
const askAI = async (prompt, selectedId = null) => {
    // ── Construction de la file de fallback ──────────────────────────
    let providersToTry;

    if (selectedId !== null) {
        const primary   = AI_PROVIDERS.find((p) => p.id === selectedId);
        const after     = AI_PROVIDERS.filter((p) => p.id > selectedId);
        const before    = AI_PROVIDERS.filter((p) => p.id < selectedId);

        providersToTry = primary
            ? [primary, ...after, ...before]
            : AI_PROVIDERS; // ID introuvable → on essaie tout
    } else {
        providersToTry = [...AI_PROVIDERS];
    }

    const primaryName = providersToTry[0]?.name ?? 'Unknown';

    // ── Parcours de la file ──────────────────────────────────────────
    for (const provider of providersToTry) {
        const isPrimary  = provider.id === selectedId;
        const maxRetries = isPrimary ? CONFIG.MAX_RETRIES : 1;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(
                    `🤖 Trying ${provider.name}` +
                    (maxRetries > 1 ? ` (attempt ${attempt}/${maxRetries})` : '') +
                    '...'
                );

                const text = await callProvider(provider, prompt, attempt);

                return {
                    response     : text,
                    provider     : provider.name,
                    usedFallback : provider.name !== primaryName
                };

            } catch (err) {
                const isLastAttempt = attempt === maxRetries;
                console.warn(
                    `⚠️  ${provider.name} — attempt ${attempt}: ${err.message}`
                );

                if (!isLastAttempt) {
                    await sleep(CONFIG.RETRY_DELAY_MS * attempt);
                }
            }
        }

        console.log(`❌ ${provider.name} exhausted — switching to next fallback.`);
    }

    throw new Error('All AI services are currently unavailable');
};

// ╔══════════════════════════════════════════════════╗
// ║           EXPORT DU MODULE WHATSAPP              ║
// ╚══════════════════════════════════════════════════╝

module.exports = {
    name        : 'ai',
    aliases     : ['ia', 'ask', 'chat', 'gpt', 'llm', 'assistant'],
    description : 'AI Assistant with automatic fallback',

    async execute({ sock, msg, args, jid }) {
        const from = jid || msg?.key?.remoteJid;

        if (!from) {
            console.error('❌ JID not available');
            return;
        }

        // ── Réaction rapide ──────────────────────────────────────────

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
                    ...(withContext && { contextInfo: buildContextInfo(from) })
                },
                { quoted: msg }
            );

        // ════════════════════════════════════════════════════════════
        // 📋  COMMANDE : .ai list — Affichage des fournisseurs
        // ════════════════════════════════════════════════════════════

        if (args.length === 0 || args[0].toLowerCase() === 'list') {
            await react('📋');

            const listMessage =
`╭━━━━❲ *AI ASSISTANTS* ❳━━━━╮
┃
┃  🤖 *Available models :*
┃
${getProviderList()}
┃
┃  📌 *Usage :*
┃  • .ai [question]
┃  • .ai [id] [question]
┃  • .ai list
┃
┃  💡 *Examples :*
┃  .ai What is AI?
┃  .ai 1 Tell me a joke
┃  .ai 3 Explain quantum physics
┃
┃  ⚠️ *No API key required*
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            return reply(listMessage, true);
        }

        // ════════════════════════════════════════════════════════════
        // 🔍  DÉTECTION : ID spécifique + extraction du prompt
        // ════════════════════════════════════════════════════════════

        let selectedId = null;
        let prompt     = '';

        const firstArg   = args[0];
        const parsedId   = parseInt(firstArg, 10);
        const isValidId  =
            !isNaN(parsedId) &&
            parsedId >= 1    &&
            parsedId <= AI_PROVIDERS.length;

        if (isValidId) {
            selectedId = parsedId;
            prompt     = args.slice(1).join(' ').trim();
        } else {
            prompt = args.join(' ').trim();
        }

        // ── Prompt vide ──────────────────────────────────────────────

        if (!prompt) {
            await react('❓');
            return reply(
                `❌ *Question missing*\n\nUsage : .ai [question]\n\n*Examples :*\n.ai What is AI?\n.ai 1 Tell me a joke\n.ai list → View all AIs\n\n━━━━━━━━━━━━━━━\n_©CybernovA_`
            );
        }

        // ════════════════════════════════════════════════════════════
        // 🔄  APPEL IA + GESTION DU FALLBACK
        // ════════════════════════════════════════════════════════════

        await react('🤖');
        await reply('🤖 *Generating response...*\n\n_This may take a few seconds._');

        try {
            const result = await askAI(prompt, selectedId);

            await react('✅');

            // ── Troncature si dépassement ────────────────────────────
            let response = result.response;
            if (response.length > CONFIG.MAX_RESPONSE_LENGTH) {
                response =
                    response.substring(0, CONFIG.MAX_RESPONSE_LENGTH) +
                    '...\n\n_(Response truncated)_';
            }

            const promptPreview =
                prompt.length > CONFIG.MAX_PROMPT_PREVIEW
                    ? prompt.substring(0, CONFIG.MAX_PROMPT_PREVIEW) + '...'
                    : prompt;

            const fallbackNotice = result.usedFallback
                ? `\n┃  🔀 *Fallback used*`
                : '';

            const responseMessage =
`╭━━━━❲ *AI RESPONSE* ❳━━━━╮
┃
┃  🤖 *Question :*
┃  ${promptPreview}
┃
┃  ✨ *Answer :*
┃  ${response}
┃
┃  📡 *Source :* ${result.provider}${fallbackNotice}
┃  ⏱️ *Time :* ${new Date().toLocaleTimeString()}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await reply(responseMessage, true);

        } catch (error) {
            console.error('❌ AI Error:', error);
            await react('💥');

            const errorMessage =
`╭━━━━❲ *AI ERROR* ❳━━━━╮
┃
┃  ❌ *All AI services are*
┃  *temporarily unavailable*
┃
┃  📝 *Error :* ${error.message}
┃
┃  💡 *Solutions :*
┃  • Try again in a few minutes
┃  • Use .ai list to see
┃    available services
┃  • Try with a specific ID
┃    ex: .ai 1 [question]
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await reply(errorMessage);
        }
    }
};
