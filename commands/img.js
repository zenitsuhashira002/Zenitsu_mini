'use strict';

/**
 * ╔══════════════════════════════════════════════════════╗
 * ║              COMMAND .image — CybernovA             ║
 * ║      Multi-source image search with auto-fallback   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Dependency required:
 *   npm install axios
 *
 * Flow:
 *   .image [keyword]       → search all providers (fallback cascade)
 *   .image [id] [keyword]  → search a specific provider first, then fallback
 *   .image list            → display all available providers
 */

let axios;
try { axios = require('axios'); } catch (_) {}

// ╔══════════════════════════════════════════════════════╗
// ║                   GLOBAL CONFIG                      ║
// ╚══════════════════════════════════════════════════════╝

const CONFIG = {
    RESULTS_LIMIT   : 5,
    SEND_DELAY_MS   : 600,
    REQUEST_TIMEOUT : 12_000,
    URL_MAX_LENGTH  : 600,
    TITLE_MAX_LEN   : 30,

    VALID_EXTENSIONS: /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i,
    VALID_URL       : /^https?:\/\/.{10,}/,

    NEWSLETTER: {
        jid            : '120363425394543602@newsletter',
        name           : '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 195
    },

    HTTP_HEADERS: {
        'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
};

// ╔══════════════════════════════════════════════════════╗
// ║              IMAGE SEARCH PROVIDERS                  ║
// ╚══════════════════════════════════════════════════════╝

const IMAGE_PROVIDERS = [

    // ── 1. DuckDuckGo — token-based image API ───────────────────────
    {
        id         : 1,
        name       : 'DuckDuckGo',
        description: 'Privacy-focused image search',
        available  : () => !!axios,
        search     : async (query, limit) => {
            // Step 1: get vqd token
            const homeRes = await axios.get('https://duckduckgo.com/', {
                params : { q: query },
                headers: CONFIG.HTTP_HEADERS,
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            const vqd = homeRes.data?.match(/vqd=([\d-]+)/)?.[1]
                     ?? homeRes.data?.match(/vqd="([\d-]+)"/)?.[1];

            if (!vqd) throw new Error('DuckDuckGo: vqd token not found');

            // Step 2: call image API
            const apiRes = await axios.get('https://duckduckgo.com/i.js', {
                params : { q: query, o: 'json', p: 1, vqd, f: ',,,', l: 'us-en' },
                headers: { ...CONFIG.HTTP_HEADERS, Referer: 'https://duckduckgo.com/' },
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            return (apiRes.data?.results ?? [])
                .slice(0, limit)
                .map((r) => r.image)
                .filter(isValidImageUrl);
        }
    },

    // ── 2. Bing Images — JSON embedded in HTML ──────────────────────
    {
        id         : 2,
        name       : 'Bing Images',
        description: 'Microsoft Bing image search',
        available  : () => !!axios,
        search     : async (query, limit) => {
            const res = await axios.get('https://www.bing.com/images/search', {
                params : { q: query, form: 'HDRSC2', first: 1, count: limit * 3 },
                headers: CONFIG.HTTP_HEADERS,
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            const urls = [];
            const html = res.data ?? '';

            // Extract from murl (original image URL embedded in data)
            const murlMatches = html.matchAll(/"murl":"(https?:\/\/[^"]+)"/g);
            for (const m of murlMatches) {
                if (isValidImageUrl(m[1])) {
                    urls.push(m[1]);
                    if (urls.length >= limit) break;
                }
            }

            // Regex fallback if JSON extraction failed
            if (urls.length === 0) {
                const regexMatches = html.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*/gi) ?? [];
                for (const u of regexMatches) {
                    if (isValidImageUrl(u) && !u.includes('bing.com') && !urls.includes(u)) {
                        urls.push(u);
                        if (urls.length >= limit) break;
                    }
                }
            }

            return urls;
        }
    },

    // ── 3. Pexels — public scraping ─────────────────────────────────
    {
        id         : 3,
        name       : 'Pexels',
        description: 'High-quality free stock photos',
        available  : () => !!axios,
        search     : async (query, limit) => {
            const res = await axios.get(
                `https://www.pexels.com/search/${encodeURIComponent(query)}/`,
                { headers: CONFIG.HTTP_HEADERS, timeout: CONFIG.REQUEST_TIMEOUT }
            );

            const html   = res.data ?? '';
            const urls   = [];

            // JSON data embedded in __NEXT_DATA__
            const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s)?.[1];
            if (nextData) {
                try {
                    const parsed = JSON.parse(nextData);
                    const photos =
                        parsed?.props?.pageProps?.photos
                        ?? parsed?.props?.pageProps?.medias
                        ?? [];

                    for (const p of photos.slice(0, limit)) {
                        const src = p?.src?.large ?? p?.src?.medium ?? p?.src?.original;
                        if (src && isValidImageUrl(src)) urls.push(src);
                    }
                } catch (_) {}
            }

            // Regex fallback
            if (urls.length === 0) {
                const matches = html.match(/https?:\/\/images\.pexels\.com\/photos\/[^"'?]+\.(?:jpg|jpeg|png|webp)[^"']*/gi) ?? [];
                for (const u of matches) {
                    if (!urls.includes(u)) {
                        urls.push(u);
                        if (urls.length >= limit) break;
                    }
                }
            }

            return urls.slice(0, limit);
        }
    },

    // ── 4. Unsplash — public scraping ───────────────────────────────
    {
        id         : 4,
        name       : 'Unsplash',
        description: 'Professional free-to-use photography',
        available  : () => !!axios,
        search     : async (query, limit) => {
            const res = await axios.get(
                `https://unsplash.com/s/photos/${encodeURIComponent(query)}`,
                { headers: CONFIG.HTTP_HEADERS, timeout: CONFIG.REQUEST_TIMEOUT }
            );

            const html  = res.data ?? '';
            const urls  = [];

            // JSON embedded in <script> tags
            const jsonBlocks = [...html.matchAll(/<script[^>]*>(\{.+?\})<\/script>/gs)];
            for (const block of jsonBlocks) {
                try {
                    const data = JSON.parse(block[1]);
                    const photos = data?.photos?.results ?? data?.searchPhotos?.results ?? [];
                    for (const p of photos.slice(0, limit)) {
                        const src = p?.urls?.regular ?? p?.urls?.small;
                        if (src && isValidImageUrl(src)) urls.push(src);
                    }
                    if (urls.length >= limit) break;
                } catch (_) {}
            }

            // Regex fallback
            if (urls.length === 0) {
                const matches = html.match(/https?:\/\/images\.unsplash\.com\/photo-[^"'?]+\.(?:jpg|jpeg|webp)[^"']*/gi) ?? [];
                for (const u of matches) {
                    const clean = u.split('?')[0];
                    if (!urls.includes(clean)) {
                        urls.push(clean);
                        if (urls.length >= limit) break;
                    }
                }
            }

            return urls.slice(0, limit);
        }
    },

    // ── 5. Pixabay — free public API (no key for basic use) ─────────
    {
        id         : 5,
        name       : 'Pixabay',
        description: 'Free media library — photos & illustrations',
        available  : () => !!axios,
        search     : async (query, limit) => {
            // Public endpoint (rate-limited but key-free)
            const res = await axios.get('https://pixabay.com/api/', {
                params : {
                    key       : 'public',        // replaced by scraping below
                    q         : encodeURIComponent(query),
                    image_type: 'photo',
                    per_page  : limit,
                    safesearch: true
                },
                headers: CONFIG.HTTP_HEADERS,
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            // If API returns data, use it
            const hits = res.data?.hits ?? [];
            if (hits.length > 0) {
                return hits.slice(0, limit).map((h) => h.webformatURL).filter(isValidImageUrl);
            }

            // Scraping fallback
            const pageRes = await axios.get(
                `https://pixabay.com/images/search/${encodeURIComponent(query)}/`,
                { headers: CONFIG.HTTP_HEADERS, timeout: CONFIG.REQUEST_TIMEOUT }
            );

            const urls    = [];
            const matches = pageRes.data?.match(/https?:\/\/cdn\.pixabay\.com\/photo\/[^"'?]+\.(?:jpg|jpeg|webp)[^"']*/gi) ?? [];
            for (const u of matches) {
                const clean = u.split('?')[0];
                if (!urls.includes(clean)) {
                    urls.push(clean);
                    if (urls.length >= limit) break;
                }
            }

            return urls;
        }
    },

    // ── 6. Flickr — public photo feed (JSON, no key) ────────────────
    {
        id         : 6,
        name       : 'Flickr',
        description: 'Community photo sharing platform',
        available  : () => !!axios,
        search     : async (query, limit) => {
            const res = await axios.get('https://api.flickr.com/services/feeds/photos_public.gne', {
                params : { tags: query, format: 'json', nojsoncallback: 1, lang: 'en-us' },
                headers: CONFIG.HTTP_HEADERS,
                timeout: CONFIG.REQUEST_TIMEOUT
            });

            const items = res.data?.items ?? [];
            return items
                .slice(0, limit)
                .map((item) => {
                    // Upgrade to medium_640 for better resolution
                    const url = item.media?.m ?? '';
                    return url.replace('_m.jpg', '_z.jpg');
                })
                .filter(isValidImageUrl);
        }
    },

    // ── 7. Lorem Picsum — deterministic placeholder (last resort) ───
    {
        id         : 7,
        name       : 'Lorem Picsum',
        description: 'High-resolution placeholder images (last resort)',
        available  : () => true,     // no dependency, always available
        search     : async (_query, limit) => {
            // Uses /v2/list to get real curated photos
            const res = await (axios
                ? axios.get('https://picsum.photos/v2/list', {
                      params : { page: Math.ceil(Math.random() * 10), limit },
                      timeout: CONFIG.REQUEST_TIMEOUT
                  })
                : fetch('https://picsum.photos/v2/list?page=1&limit=' + limit)
                      .then((r) => ({ data: r.json() }))
            );

            return (res.data ?? [])
                .slice(0, limit)
                .map((p) => `https://picsum.photos/id/${p.id}/800/600`);
        }
    }
];

// ╔══════════════════════════════════════════════════════╗
// ║                    UTILITIES                         ║
// ╚══════════════════════════════════════════════════════╝

/**
 * Validates that a URL is a reachable image URL.
 */
const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    if (url.length > CONFIG.URL_MAX_LENGTH)  return false;
    if (!CONFIG.VALID_URL.test(url))         return false;
    if (url.includes('data:image'))          return false;
    return CONFIG.VALID_EXTENSIONS.test(url.split('?')[0]) || url.includes('picsum.photos');
};

/**
 * Deduplicates and caps an array of image URLs.
 */
const dedupeUrls = (urls, limit) =>
    [...new Set(urls.filter(isValidImageUrl))].slice(0, limit);

/**
 * Builds the standard newsletter contextInfo block.
 */
const buildContextInfo = (from) => ({
    mentionedJid: [from],
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid      : CONFIG.NEWSLETTER.jid,
        newsletterName     : CONFIG.NEWSLETTER.name,
        serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
    }
});

/**
 * Truncates a string and appends ellipsis if over max.
 */
const truncate = (str, max) =>
    str?.length > max ? str.substring(0, max) + '…' : (str ?? '');

/**
 * Generates the formatted provider list for .image list.
 */
const getProviderList = () =>
    IMAGE_PROVIDERS
        .map((p) => `┃  ${p.id}. *${p.name}*\n┃     ${p.description}`)
        .join('\n┃\n');

// ╔══════════════════════════════════════════════════════╗
// ║           SEARCH ENGINE — FALLBACK CASCADE           ║
// ╚══════════════════════════════════════════════════════╝

/**
 * Searches image providers in priority order.
 *
 * When selectedId is provided:
 *   → Tries that provider first
 *   → Falls back to providers with higher IDs
 *   → Then tries providers with lower IDs
 *   → Lorem Picsum (#7) is always last resort
 *
 * @param {string}      query
 * @param {number}      limit
 * @param {number|null} selectedId
 * @returns {{ urls: string[], sources: string[] }}
 */
const searchImages = async (query, limit = CONFIG.RESULTS_LIMIT, selectedId = null) => {
    let orderedProviders;

    if (selectedId !== null) {
        const primary = IMAGE_PROVIDERS.find((p) => p.id === selectedId);
        const after   = IMAGE_PROVIDERS.filter((p) => p.id > selectedId);
        const before  = IMAGE_PROVIDERS.filter((p) => p.id < selectedId && p.id !== 7);
        const lastRes = IMAGE_PROVIDERS.find((p) => p.id === 7);

        orderedProviders = [
            ...(primary ? [primary] : []),
            ...after.filter((p) => p.id !== 7),
            ...before,
            ...(lastRes ? [lastRes] : [])
        ];
    } else {
        orderedProviders = [...IMAGE_PROVIDERS];
    }

    const collectedUrls    = [];
    const usedSources      = [];

    for (const provider of orderedProviders) {
        if (collectedUrls.length >= limit) break;

        if (!provider.available()) {
            console.log(`⏭️  ${provider.name} — unavailable, skipping.`);
            continue;
        }

        try {
            console.log(`🔍 Trying ${provider.name}…`);

            const raw    = await provider.search(query, limit - collectedUrls.length);
            const valid  = dedupeUrls(raw, limit - collectedUrls.length);

            if (valid.length > 0) {
                collectedUrls.push(...valid);
                usedSources.push(`${provider.name} (${valid.length})`);
                console.log(`✅ ${provider.name} — ${valid.length} image(s) found.`);
            } else {
                console.log(`⚠️  ${provider.name} — 0 valid results, fallback.`);
            }
        } catch (err) {
            console.warn(`❌ ${provider.name} — ${err.message}`);
        }
    }

    return {
        urls   : dedupeUrls(collectedUrls, limit),
        sources: usedSources
    };
};

// ╔══════════════════════════════════════════════════════╗
// ║                  EXPORTED MODULE                     ║
// ╚══════════════════════════════════════════════════════╝

module.exports = {
    name       : 'image',
    aliases    : ['img', 'search', 'photo', 'picture', 'find'],
    description: 'Search and send images with automatic multi-source fallback',

    async execute({ sock, msg, args, jid }) {
        const from = jid || msg?.key?.remoteJid;

        if (!from) {
            console.error('❌ JID not available');
            return;
        }

        // ── Local helpers ────────────────────────────────────────────

        const react = async (emoji) => {
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            }
        };

        const reply = (text, withContext = false) =>
            sock.sendMessage(
                from,
                { text, ...(withContext && { contextInfo: buildContextInfo(from) }) },
                { quoted: msg }
            );

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        // ════════════════════════════════════════════════════════════
        // 📋  .image list — Provider directory
        // ════════════════════════════════════════════════════════════

        if (args.length === 0 || args[0].toLowerCase() === 'list') {
            await react('📋');

            const listMessage =
`╭━━━━❲ *IMAGE SEARCH* ❳━━━━╮
┃
┃  🔍 *Available services :*
┃
${getProviderList()}
┃
┃  📌 *Usage :*
┃  • .image [keyword]
┃  • .image [id] [keyword]
┃  • .image list
┃
┃  💡 *Examples :*
┃  .image cat
┃  .image 1 landscape
┃  .image 3 red car
┃
┃  ⚠️ *Limit :* ${CONFIG.RESULTS_LIMIT} images per search
┃  🔄 *Auto-fallback :* enabled
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            return reply(listMessage, true);
        }

        // ════════════════════════════════════════════════════════════
        // 🔍  Query & ID parsing
        // ════════════════════════════════════════════════════════════

        let selectedId = null;
        let query      = '';

        const parsedId  = parseInt(args[0], 10);
        const isValidId =
            !isNaN(parsedId) &&
            parsedId >= 1    &&
            parsedId <= IMAGE_PROVIDERS.length;

        if (isValidId) {
            selectedId = parsedId;
            query      = args.slice(1).join(' ').trim();
        } else {
            query = args.join(' ').trim();
        }

        if (!query) {
            await react('❓');
            return reply(
`❌ *Missing keyword*

Usage : .image [keyword]

*Examples :*
.image cat
.image 1 landscape
.image list → View all services

━━━━━━━━━━━━━━━
_©CybernovA_`
            );
        }

        // ════════════════════════════════════════════════════════════
        // ⏳  Search in progress
        // ════════════════════════════════════════════════════════════

        await react('🔍');

        const providerName = selectedId
            ? IMAGE_PROVIDERS.find((p) => p.id === selectedId)?.name ?? `Provider #${selectedId}`
            : 'Auto';

        await reply(
`🔍 *Searching images…*

📝 *Query :* "${truncate(query, CONFIG.TITLE_MAX_LEN)}"
📡 *Mode :* ${providerName}
⏳ Please wait…`
        );

        // ════════════════════════════════════════════════════════════
        // 🖼️  Search & send results
        // ════════════════════════════════════════════════════════════

        try {
            const { urls, sources } = await searchImages(
                query,
                CONFIG.RESULTS_LIMIT,
                selectedId
            );

            // ── No results ───────────────────────────────────────────
            if (urls.length === 0) {
                await react('❌');
                return reply(
`╭━━━━❲ *NO IMAGES FOUND* ❳━━━━╮
┃
┃  ❌ *No results for :*
┃  "${truncate(query, CONFIG.TITLE_MAX_LEN)}"
┃
┃  💡 *Suggestions :*
┃  • Check spelling
┃  • Try different keywords
┃  • Use .image list to browse
┃    all available services
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`,
                    true
                );
            }

            await react('✅');

            // ── Send each image individually ─────────────────────────
            let totalSent    = 0;
            let totalFailed  = 0;

            for (const imageUrl of urls) {
                try {
                    const caption =
`🖼️ *${truncate(query, CONFIG.TITLE_MAX_LEN)}*
📡 *Source :* ${sources[0]?.split(' (')[0] ?? 'Unknown'}
🔢 ${totalSent + 1} / ${urls.length}
━━━━━━━━━━━━━━━
_©CybernovA_`;

                    await sock.sendMessage(from, {
                        image  : { url: imageUrl },
                        caption,
                        contextInfo: buildContextInfo(from)
                    });

                    totalSent++;
                    await sleep(CONFIG.SEND_DELAY_MS);

                } catch (sendErr) {
                    console.warn(`⚠️  Failed to send image: ${imageUrl} — ${sendErr.message}`);
                    totalFailed++;
                }
            }

            // ── Summary message ──────────────────────────────────────
            const fallbackUsed = sources.length > 1;

            const summaryMessage =
`╭━━━━❲ *SEARCH COMPLETE* ❳━━━━╮
┃
┃  ✅ *${totalSent} image(s) sent*
┃  📝 "${truncate(query, CONFIG.TITLE_MAX_LEN)}"
┃
┃  📡 *Sources used :*
${sources.map((s) => `┃  • ${s}`).join('\n')}
${fallbackUsed ? '┃\n┃  🔀 *Fallback was triggered*' : ''}
${totalFailed > 0 ? `┃  ⚠️  ${totalFailed} image(s) failed to send` : ''}
┃
┃  💡 *Tip :*
┃  Use .image [id] [keyword]
┃  to target a specific source
┃  Ex: .image 3 sunset
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`;

            await reply(summaryMessage);

        } catch (error) {
            console.error('❌ Search error:', error);
            await react('💥');

            await reply(
`╭━━━━❲ *SEARCH ERROR* ❳━━━━╮
┃
┃  ❌ *Unable to complete*
┃  *the search*
┃
┃  📝 *Error :* ${truncate(error.message, 50)}
┃
┃  💡 *Solutions :*
┃  • Try again in a few minutes
┃  • Use a different keyword
┃  • Check: npm install axios
┃  • Try .image list to see
┃    available services
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`
            );
        }
    }
};
