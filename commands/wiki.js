// ./commands/wiki.js

const axios = require('axios');

const STYLE = {
    forwardingScore: 355,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363425394543602@newsletter',
        newsletterName: '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 202,
    },
};

const cache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    if (cache.size > 200) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        cache.delete(oldest[0]);
    }
}

// ========================================
// LANGUES SUPPORTÉES
// ========================================
const LANGUAGES = {
    'fr': { code: 'fr', name: 'Français', wiki: 'fr.wikipedia.org', wikt: 'fr.wiktionary.org' },
    'en': { code: 'en', name: 'English', wiki: 'en.wikipedia.org', wikt: 'en.wiktionary.org' },
    'es': { code: 'es', name: 'Español', wiki: 'es.wikipedia.org', wikt: 'es.wiktionary.org' },
    'de': { code: 'de', name: 'Deutsch', wiki: 'de.wikipedia.org', wikt: 'de.wiktionary.org' },
    'it': { code: 'it', name: 'Italiano', wiki: 'it.wikipedia.org', wikt: 'it.wiktionary.org' },
    'pt': { code: 'pt', name: 'Português', wiki: 'pt.wikipedia.org', wikt: 'pt.wiktionary.org' },
    'ht': { code: 'ht', name: 'Kreyòl Ayisyen', wiki: 'ht.wikipedia.org', wikt: 'ht.wiktionary.org' },
    'nl': { code: 'nl', name: 'Nederlands', wiki: 'nl.wikipedia.org', wikt: 'nl.wiktionary.org' },
    'pl': { code: 'pl', name: 'Polski', wiki: 'pl.wikipedia.org', wikt: 'pl.wiktionary.org' },
    'ru': { code: 'ru', name: 'Русский', wiki: 'ru.wikipedia.org', wikt: 'ru.wiktionary.org' },
    'ja': { code: 'ja', name: '日本語', wiki: 'ja.wikipedia.org', wikt: 'ja.wiktionary.org' },
    'zh': { code: 'zh', name: '中文', wiki: 'zh.wikipedia.org', wikt: 'zh.wiktionary.org' },
    'ar': { code: 'ar', name: 'العربية', wiki: 'ar.wikipedia.org', wikt: 'ar.wiktionary.org' },
    'hi': { code: 'hi', name: 'हिन्दी', wiki: 'hi.wikipedia.org', wikt: 'hi.wiktionary.org' },
};

const LANGUAGE_NAMES = Object.keys(LANGUAGES);

// ========================================
// 1. WIKIPEDIA MULTILINGUE
// ========================================
async function fetchFromWikipedia(query, lang = 'en') {
    try {
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];
        const wikiUrl = langConfig.wiki;
        
        console.log(`📚 Wiki: Searching ${langConfig.name} Wikipedia for "${query}"...`);

        const response = await axios.get(`https://${wikiUrl}/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                srsearch: query,
                srnamespace: 0,
                srlimit: 1,
                list: 'search',
                utf8: 1,
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        if (!response.data.query?.search || response.data.query.search.length === 0) {
            return null;
        }

        const title = response.data.query.search[0].title;
        const snippet = response.data.query.search[0].snippet
            .replace(/<[^>]+>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim();

        // Fetch la page complète
        const pageResponse = await axios.get(`https://${wikiUrl}/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                titles: title,
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                utf8: 1,
            },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        const pages = pageResponse.data.query.pages;
        const page = Object.values(pages)[0];

        if (!page?.extract) {
            return {
                source: `Wikipedia (${langConfig.name})`,
                title,
                content: snippet,
                url: `https://${wikiUrl}/wiki/${encodeURIComponent(title)}`,
                lang: langConfig,
            };
        }

        let content = page.extract.slice(0, 500);
        if (page.extract.length > 500) {
            content = content.slice(0, content.lastIndexOf(' ')) + '...';
        }

        return {
            source: `Wikipedia (${langConfig.name})`,
            title,
            content,
            url: `https://${wikiUrl}/wiki/${encodeURIComponent(title)}`,
            lang: langConfig,
        };
    } catch (err) {
        console.log(`⚠️ Wikipedia (${lang}) error: ${err.message}`);
        return null;
    }
}

// ========================================
// 2. WIKTIONARY MULTILINGUE
// ========================================
async function fetchFromWiktionary(query, lang = 'en') {
    try {
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];
        const wiktUrl = langConfig.wikt;
        
        console.log(`📖 Wiki: Searching ${langConfig.name} Wiktionary for "${query}"...`);

        const response = await axios.get(`https://${wiktUrl}/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                titles: query,
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                utf8: 1,
            },
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        const pages = response.data.query.pages;
        const page = Object.values(pages)[0];

        if (!page?.extract || page.missing) {
            return null;
        }

        let content = page.extract.slice(0, 350);
        if (page.extract.length > 350) {
            content = content.slice(0, content.lastIndexOf(' ')) + '...';
        }

        return {
            source: `Wiktionary (${langConfig.name})`,
            title: query,
            content,
            url: `https://${wiktUrl}/wiki/${encodeURIComponent(query)}`,
            lang: langConfig,
        };
    } catch (err) {
        console.log(`⚠️ Wiktionary (${lang}) error: ${err.message}`);
        return null;
    }
}

// ========================================
// 3. WIKIDATA (Données structurées)
// ========================================
async function fetchFromWikidata(query, lang = 'en') {
    try {
        console.log(`🔗 Wiki: Searching Wikidata for "${query}"...`);

        const response = await axios.get('https://www.wikidata.org/w/api.php', {
            params: {
                action: 'wbsearchentities',
                format: 'json',
                search: query,
                language: lang,
                limit: 1,
            },
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        if (!response.data?.search || response.data.search.length === 0) {
            return null;
        }

        const entity = response.data.search[0];
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];

        // Fetch plus de détails
        const detailResponse = await axios.get('https://www.wikidata.org/wiki/Special:EntityData', {
            params: {
                id: entity.id,
                format: 'json',
            },
            timeout: 8000,
        });

        const data = detailResponse.data?.entities?.[entity.id];
        const description = data?.labels?.[lang]?.value || entity.label || query;
        const aliases = data?.aliases?.[lang]?.map(a => a.value).join(', ') || '';

        let content = `📌 *Description:* ${data?.descriptions?.[lang]?.value || entity.description || 'No description'}\n`;
        if (aliases) content += `🔖 *Aliases:* ${aliases}\n`;
        content += `🆔 *ID:* ${entity.id}\n`;
        content += `🌐 *Source:* Wikidata`;

        return {
            source: `Wikidata (${langConfig.name})`,
            title: description,
            content,
            url: `https://www.wikidata.org/wiki/${entity.id}`,
            lang: langConfig,
        };
    } catch (err) {
        console.log(`⚠️ Wikidata error: ${err.message}`);
        return null;
    }
}

// ========================================
// 4. WIKIQUOTE (Citations)
// ========================================
async function fetchFromWikiquote(query, lang = 'en') {
    try {
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];
        const quoteUrl = lang === 'fr' ? 'fr.wikiquote.org' : 'en.wikiquote.org';
        
        console.log(`💬 Wiki: Searching ${langConfig.name} Wikiquote for "${query}"...`);

        const response = await axios.get(`https://${quoteUrl}/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                titles: query,
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                utf8: 1,
            },
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        const pages = response.data.query.pages;
        const page = Object.values(pages)[0];

        if (!page?.extract || page.missing) {
            return null;
        }

        let content = page.extract.slice(0, 350);
        if (page.extract.length > 350) {
            content = content.slice(0, content.lastIndexOf(' ')) + '...';
        }

        return {
            source: `Wikiquote (${langConfig.name})`,
            title: `Quotes: ${query}`,
            content,
            url: `https://${quoteUrl}/wiki/${encodeURIComponent(query)}`,
            lang: langConfig,
        };
    } catch (err) {
        console.log(`⚠️ Wikiquote error: ${err.message}`);
        return null;
    }
}

// ========================================
// 5. WIKIVOYAGE (Voyages)
// ========================================
async function fetchFromWikivoyage(query, lang = 'en') {
    try {
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];
        const voyageUrl = lang === 'fr' ? 'fr.wikivoyage.org' : 'en.wikivoyage.org';
        
        console.log(`✈️ Wiki: Searching ${langConfig.name} Wikivoyage for "${query}"...`);

        const response = await axios.get(`https://${voyageUrl}/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                srsearch: query,
                srnamespace: 0,
                srlimit: 1,
                list: 'search',
                utf8: 1,
            },
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        if (!response.data.query?.search || response.data.query.search.length === 0) {
            return null;
        }

        const title = response.data.query.search[0].title;
        
        return {
            source: `Wikivoyage (${langConfig.name})`,
            title: `Travel: ${title}`,
            content: `🌍 Travel guide for ${title}\n📚 Found on Wikivoyage`,
            url: `https://${voyageUrl}/wiki/${encodeURIComponent(title)}`,
            lang: langConfig,
        };
    } catch (err) {
        console.log(`⚠️ Wikivoyage error: ${err.message}`);
        return null;
    }
}

// ========================================
// 6. REST COUNTRIES (Pays)
// ========================================
async function fetchCountryInfo(query) {
    try {
        console.log(`🌍 Wiki: Searching country "${query}"...`);

        const response = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`, {
            timeout: 6000,
        });

        if (!response.data || response.data.length === 0) {
            return null;
        }

        const country = response.data[0];
        const languages = Object.values(country.languages || {});
        const currencies = Object.values(country.currencies || {});
        
        const content = `📍 *Capital:* ${country.capital?.[0] || 'N/A'}\n` +
                       `👥 *Population:* ${country.population?.toLocaleString() || 'N/A'}\n` +
                       `🗣️ *Languages:* ${languages.slice(0, 3).join(', ') || 'N/A'}\n` +
                       `💱 *Currency:* ${currencies.map(c => `${c.name} (${c.symbol})`).join(', ') || 'N/A'}\n` +
                       `🌍 *Region:* ${country.region || 'N/A'}\n` +
                       `🏳️ *Flag:* ${country.flags?.png || 'N/A'}`;

        return {
            source: 'REST Countries',
            title: country.name.common,
            content,
            url: country.maps?.googleMaps || `https://www.wikipedia.org/wiki/${country.name.common}`,
        };
    } catch (err) {
        console.log(`⚠️ REST Countries error: ${err.message}`);
        return null;
    }
}

// ========================================
// 7. OPEN LIBRARY (Livres)
// ========================================
async function fetchBookInfo(query) {
    try {
        console.log(`📚 Wiki: Searching books for "${query}"...`);

        const response = await axios.get('https://openlibrary.org/search.json', {
            params: {
                title: query,
                limit: 1,
            },
            timeout: 8000,
        });

        if (!response.data?.docs || response.data.docs.length === 0) {
            return null;
        }

        const book = response.data.docs[0];
        const content = `📖 *Author:* ${(book.author_name || ['N/A']).join(', ')}\n` +
                       `📅 *Published:* ${book.first_publish_year || 'N/A'}\n` +
                       `⭐ *Editions:* ${book.edition_count || 'N/A'}\n` +
                       `🔖 *Subjects:* ${(book.subject || []).slice(0, 3).join(', ') || 'N/A'}\n` +
                       `📝 *ISBN:* ${(book.isbn || []).slice(0, 2).join(', ') || 'N/A'}`;

        return {
            source: 'Open Library',
            title: book.title,
            content,
            url: `https://openlibrary.org${book.key}`,
        };
    } catch (err) {
        console.log(`⚠️ Open Library error: ${err.message}`);
        return null;
    }
}

// ========================================
// 8. DICTIONNAIRE (via API externe)
// ========================================
async function fetchDictionary(query, lang = 'en') {
    try {
        console.log(`📖 Wiki: Searching dictionary for "${query}"...`);

        let apiUrl = '';
        if (lang === 'fr') {
            apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/fr/${encodeURIComponent(query)}`;
        } else {
            apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`;
        }

        const response = await axios.get(apiUrl, { timeout: 6000 });

        if (!response.data || response.data.length === 0) {
            return null;
        }

        const entry = response.data[0];
        const meanings = entry.meanings || [];
        
        let content = `📖 *Definition*\n\n`;
        for (const meaning of meanings.slice(0, 3)) {
            const partOfSpeech = meaning.partOfSpeech || 'N/A';
            const definition = meaning.definitions?.[0]?.definition || 'No definition';
            content += `*${partOfSpeech}*: ${definition}\n`;
            if (meaning.definitions?.[0]?.example) {
                content += `   _Example: ${meaning.definitions[0].example}_\n`;
            }
            content += '\n';
        }

        if (entry.phonetics?.[0]?.text) {
            content += `🔊 *Pronunciation:* ${entry.phonetics[0].text}\n`;
        }

        return {
            source: 'Free Dictionary API',
            title: query,
            content: content.slice(0, 400),
            lang: LANGUAGES[lang] || LANGUAGES['en'],
        };
    } catch (err) {
        console.log(`⚠️ Dictionary error: ${err.message}`);
        return null;
    }
}

// ========================================
// 9. WIKIMEDIA COMMONS (Images)
// ========================================
async function fetchImageInfo(query) {
    try {
        console.log(`🖼️ Wiki: Searching images for "${query}"...`);

        const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                srlimit: 1,
                srnamespace: 6,
                utf8: 1,
            },
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ZenitsuBot/1.0)',
            },
        });

        if (!response.data.query?.search || response.data.query.search.length === 0) {
            return null;
        }

        return {
            source: 'Wikimedia Commons',
            title: `Image: ${response.data.query.search[0].title}`,
            content: `🖼️ Image found on Wikimedia Commons\n🔍 Search: ${query}`,
            url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(response.data.query.search[0].title)}`,
        };
    } catch (err) {
        console.log(`⚠️ Wikimedia error: ${err.message}`);
        return null;
    }
}

// ========================================
// FONCTION PRINCIPALE
// ========================================
module.exports = {
    name: 'wiki',
    aliases: ['wikipedia', 'define', 'search', 'info', 'wikidata'],
    category: 'utility',

    async execute({ sock, msg, args, jid }) {
        // Détecter la langue
        let lang = 'en';
        let query = '';

        if (args.length >= 2 && LANGUAGE_NAMES.includes(args[0].toLowerCase())) {
            lang = args[0].toLowerCase();
            query = args.slice(1).join(' ').trim();
        } else {
            query = args.join(' ').trim();
        }

        if (!query || query.length < 2) {
            const langList = LANGUAGE_NAMES.map(l => `• .wiki ${l} <topic>`).join('\n');
            
            return sock.sendMessage(jid, {
                text: `📚 *Wiki Search - Multilingual*\n\n` +
                      `⚡ *Usage:*\n` +
                      `.wiki <topic> (default: English)\n` +
                      `.wiki <lang> <topic>\n\n` +
                      `✨ *Examples:*\n` +
                      `• .wiki Einstein (English)\n` +
                      `• .wiki fr Einstein (Français)\n` +
                      `• .wiki ht Zenitsu (Kreyòl)\n` +
                      `• .wiki es España (Español)\n` +
                      `• .wiki de Berlin (Deutsch)\n\n` +
                      `🌐 *Supported Languages:*\n${langList}\n\n` +
                      `🔍 *Sources:* Wikipedia, Wikidata, Wiktionary, Wikiquote, Wikivoyage, Dictionary, REST Countries, Open Library & more`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Cache check
        const cacheKey = `${lang}:${query.toLowerCase()}`;
        const cached = getCached(cacheKey);
        if (cached) {
            await sock.sendMessage(jid, { text: cached, contextInfo: STYLE }, { quoted: msg });
            try { await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } }); } catch (_) {}
            return;
        }

        try { await sock.sendMessage(jid, { react: { text: '📚', key: msg.key } }); } catch (_) {}

        let results = [];
        let errors = [];
        const langConfig = LANGUAGES[lang] || LANGUAGES['en'];

        // 1. Wikipedia
        try {
            const wikiResult = await fetchFromWikipedia(query, lang);
            if (wikiResult) results.push(wikiResult);
        } catch (err) { errors.push('Wikipedia'); }

        // 2. Wikidata (si pas de résultat Wikipedia)
        if (results.length === 0) {
            try {
                const wikidataResult = await fetchFromWikidata(query, lang);
                if (wikidataResult) results.push(wikidataResult);
            } catch (err) { errors.push('Wikidata'); }
        }

        // 3. Wiktionary (Définitions)
        if (results.length === 0) {
            try {
                const wiktResult = await fetchFromWiktionary(query, lang);
                if (wiktResult) results.push(wiktResult);
            } catch (err) { errors.push('Wiktionary'); }
        }

        // 4. Dictionary (API externe)
        if (results.length === 0) {
            try {
                const dictResult = await fetchDictionary(query, lang);
                if (dictResult) results.push(dictResult);
            } catch (err) { errors.push('Dictionary'); }
        }

        // 5. Wikiquote
        if (results.length === 0) {
            try {
                const quoteResult = await fetchFromWikiquote(query, lang);
                if (quoteResult) results.push(quoteResult);
            } catch (err) { errors.push('Wikiquote'); }
        }

        // 6. Country Info
        if (results.length === 0 && query.length < 30) {
            try {
                const countryResult = await fetchCountryInfo(query);
                if (countryResult) results.push(countryResult);
            } catch (err) { errors.push('REST Countries'); }
        }

        // 7. Book Info
        if (results.length === 0) {
            try {
                const bookResult = await fetchBookInfo(query);
                if (bookResult) results.push(bookResult);
            } catch (err) { errors.push('Open Library'); }
        }

        // 8. Wikivoyage
        if (results.length === 0) {
            try {
                const voyageResult = await fetchFromWikivoyage(query, lang);
                if (voyageResult) results.push(voyageResult);
            } catch (err) { errors.push('Wikivoyage'); }
        }

        // 9. Wikimedia Commons
        if (results.length === 0) {
            try {
                const imageResult = await fetchImageInfo(query);
                if (imageResult) results.push(imageResult);
            } catch (err) { errors.push('Wikimedia Commons'); }
        }

        // 10. Fallback: Essaye en anglais si la recherche en langue spécifique a échoué
        if (results.length === 0 && lang !== 'en') {
            try {
                const fallbackResult = await fetchFromWikipedia(query, 'en');
                if (fallbackResult) {
                    fallbackResult.source += ' (Fallback)';
                    results.push(fallbackResult);
                }
            } catch (err) { errors.push('English Wikipedia (Fallback)'); }
        }

        // Si rien trouvé
        if (results.length === 0) {
            try { await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }); } catch (_) {}

            const langName = langConfig.name;
            return sock.sendMessage(jid, {
                text: `❌ *No results found for "${query}"*\n\n` +
                      `🌐 *Language:* ${langName}\n` +
                      `💡 *Tips:*\n` +
                      `• Try a different language: .wiki en ${query}\n` +
                      `• Use simpler keywords\n` +
                      `• Check your spelling\n\n` +
                      `⚠️ *Failed sources:* ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`,
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // Format la réponse
        let responseText = `📚 *Wiki Search Results*\n\n`;
        responseText += `🔍 *Query:* ${query}\n`;
        responseText += `🌐 *Language:* ${langConfig.name}\n\n`;

        for (const result of results.slice(0, 3)) {
            if (result.type === 'quote') {
                responseText += `💬 *Quote*\n` +
                               `${result.content}\n` +
                               `_— ${result.author}_\n\n`;
            } else {
                responseText += `📖 *${result.title.slice(0, 80)}${result.title.length > 80 ? '...' : ''}*\n`;
                responseText += `🏷️ *Source:* ${result.source}\n\n`;
                responseText += `${result.content}\n\n`;

                if (result.url) {
                    responseText += `🔗 _Read more: ${result.url.slice(0, 60)}..._\n\n`;
                }
            }
        }

        responseText += `⚡ _Powered by Zenitsu Wiki (Multilingual)_`;

        // Limiter la longueur
        if (responseText.length > 4000) {
            responseText = responseText.slice(0, 3900) + '\n\n📝 *Response truncated*\n⚡ _Powered by Zenitsu Wiki_';
        }

        // Cache la réponse
        setCache(cacheKey, responseText);

        await sock.sendMessage(jid, {
            text: responseText,
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
