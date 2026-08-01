// ./commands/script.js

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// CONFIG
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
// LANGUAGES SUPPORTED
// ═══════════════════════════════════════

const LANGUAGES = {
    // Web
    'js':        { name: 'JavaScript',      ext: 'js',   mime: 'application/javascript' },
    'javascript':{ name: 'JavaScript',      ext: 'js',   mime: 'application/javascript' },
    'ts':        { name: 'TypeScript',      ext: 'ts',   mime: 'application/typescript' },
    'typescript':{ name: 'TypeScript',      ext: 'ts',   mime: 'application/typescript' },
    'html':      { name: 'HTML',            ext: 'html', mime: 'text/html' },
    'css':       { name: 'CSS',             ext: 'css',  mime: 'text/css' },
    'jsx':       { name: 'React JSX',       ext: 'jsx',  mime: 'text/jsx' },
    'tsx':       { name: 'React TSX',       ext: 'tsx',  mime: 'text/tsx' },
    'json':      { name: 'JSON',            ext: 'json', mime: 'application/json' },
    'xml':       { name: 'XML',             ext: 'xml',  mime: 'application/xml' },
    'svg':       { name: 'SVG',             ext: 'svg',  mime: 'image/svg+xml' },

    // Backend
    'py':        { name: 'Python',          ext: 'py',   mime: 'text/x-python' },
    'python':    { name: 'Python',          ext: 'py',   mime: 'text/x-python' },
    'java':      { name: 'Java',            ext: 'java', mime: 'text/x-java' },
    'rb':        { name: 'Ruby',            ext: 'rb',   mime: 'text/x-ruby' },
    'ruby':      { name: 'Ruby',            ext: 'rb',   mime: 'text/x-ruby' },
    'php':       { name: 'PHP',             ext: 'php',  mime: 'application/x-php' },
    'go':        { name: 'Go',              ext: 'go',   mime: 'text/x-go' },
    'rs':        { name: 'Rust',            ext: 'rs',   mime: 'text/x-rust' },
    'rust':      { name: 'Rust',            ext: 'rs',   mime: 'text/x-rust' },
    'cpp':       { name: 'C++',             ext: 'cpp',  mime: 'text/x-c++' },
    'c':         { name: 'C',               ext: 'c',    mime: 'text/x-c' },
    'cs':        { name: 'C#',              ext: 'cs',   mime: 'text/x-csharp' },
    'kt':        { name: 'Kotlin',          ext: 'kt',   mime: 'text/x-kotlin' },
    'kotlin':    { name: 'Kotlin',          ext: 'kt',   mime: 'text/x-kotlin' },
    'swift':     { name: 'Swift',           ext: 'swift',mime: 'text/x-swift' },
    'dart':      { name: 'Dart',            ext: 'dart', mime: 'application/dart' },

    // Shell / Config
    'sh':        { name: 'Shell Script',    ext: 'sh',   mime: 'text/x-sh' },
    'bash':      { name: 'Bash',            ext: 'sh',   mime: 'text/x-sh' },
    'bat':       { name: 'Batch',           ext: 'bat',  mime: 'text/x-bat' },
    'ps1':       { name: 'PowerShell',      ext: 'ps1',  mime: 'text/x-powershell' },
    'yml':       { name: 'YAML',            ext: 'yml',  mime: 'text/yaml' },
    'yaml':      { name: 'YAML',            ext: 'yml',  mime: 'text/yaml' },
    'toml':      { name: 'TOML',            ext: 'toml', mime: 'text/toml' },
    'ini':       { name: 'INI',             ext: 'ini',  mime: 'text/ini' },
    'env':       { name: 'Env',             ext: 'env',  mime: 'text/plain' },
    'dockerfile':{ name: 'Dockerfile',      ext: 'Dockerfile', mime: 'text/x-dockerfile' },

    // Database
    'sql':       { name: 'SQL',             ext: 'sql',  mime: 'application/sql' },
    'graphql':   { name: 'GraphQL',         ext: 'gql',  mime: 'application/graphql' },

    // Data
    'csv':       { name: 'CSV',             ext: 'csv',  mime: 'text/csv' },
    'md':        { name: 'Markdown',        ext: 'md',   mime: 'text/markdown' },
    'markdown':  { name: 'Markdown',        ext: 'md',   mime: 'text/markdown' },
    'txt':       { name: 'Plain Text',      ext: 'txt',  mime: 'text/plain' },
    'text':      { name: 'Plain Text',      ext: 'txt',  mime: 'text/plain' },
};

// ═══════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════

module.exports = {
    name: 'script',
    aliases: ['code', 'lang', 'convert', 'file', 'makefile'],
    category: 'tools',

    async execute({ sock, msg, args, jid }) {
        const langInput = args[0]?.toLowerCase();
        const lang = LANGUAGES[langInput];

        // ═══════════════════
        // HELP
        // ═══════════════════

        if (!lang || args.length < 2) {
            const langList = Object.keys(LANGUAGES)
                .filter((k, i, arr) => arr.indexOf(k) === i) // Unique keys
                .sort()
                .map(k => `  ▸ *${k}* — ${LANGUAGES[k].name}`)
                .join('\n');

            return sock.sendMessage(jid, {
                text:
                    '💻 *Code to Document*\n\n' +
                    '⚡ *Usage:*\n' +
                    '.script <language> <code>\n' +
                    '.script <language> (reply to message)\n\n' +
                    '✨ *Examples:*\n' +
                    '.script js console.log("Hello World")\n' +
                    '.script py print("Hello World")\n' +
                    '.script html <h1>Hello</h1>\n' +
                    '.script sql SELECT * FROM users\n\n' +
                    '📋 *Available Languages:*\n' +
                    `${langList}\n\n` +
                    '💡 Reply to a message with code to convert it.\n\n' +
                    '⚡ _Zenitsu Script Converter_',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // RÉCUPÉRER LE CODE
        // ═══════════════════

        let code = '';

        // Priorité 1 : Texte dans les arguments
        const textArgs = args.slice(1).join(' ');
        if (textArgs) {
            code = textArgs;
        }

        // Priorité 2 : Message quoté
        if (!code) {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted) {
                code = quoted.conversation
                    || quoted.extendedTextMessage?.text
                    || quoted.imageMessage?.caption
                    || '';
            }
        }

        if (!code || code.trim().length < 1) {
            return sock.sendMessage(jid, {
                text:
                    '⚠️ *No code found!*\n\n' +
                    'Provide code as text or reply to a message.\n\n' +
                    'Example: .script js console.log("Hello")',
                contextInfo: STYLE,
            }, { quoted: msg });
        }

        // ═══════════════════
        // GÉNÉRER LE FICHIER
        // ═══════════════════

        try { await sock.sendMessage(jid, { react: { text: '💻', key: msg.key } }); } catch (_) {}

        const fileName = `script_${Date.now()}.${lang.ext}`;
        const buffer = Buffer.from(code, 'utf8');
        const sizeKB = (buffer.length / 1024).toFixed(2);

        // En-tête automatique pour certains langages
        let finalCode = code;
        if (langInput === 'html' && !code.includes('<html')) {
            finalCode = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Script</title>\n</head>\n<body>\n${code}\n</body>\n</html>`;
        }
        if (langInput === 'py' && !code.includes('#!/usr/bin/env')) {
            finalCode = `#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n\n${code}`;
        }
        if (langInput === 'sh' || langInput === 'bash') {
            finalCode = `#!/bin/bash\n\n${code}`;
        }

        const finalBuffer = Buffer.from(finalCode, 'utf8');

        await sock.sendMessage(jid, {
            document: finalBuffer,
            mimetype: lang.mime,
            fileName: fileName,
            caption:
                '💻 *Script Generated!*\n\n' +
                `📄 *Language:* ${lang.name}\n` +
                `📁 *File:* ${fileName}\n` +
                `📏 *Size:* ${sizeKB} KB\n` +
                `📝 *Lines:* ${code.split('\n').length}\n\n` +
                '💡 Open the file or share it directly.\n\n' +
                '⚡ _Zenitsu Script Converter_',
            contextInfo: STYLE,
        }, { quoted: msg });

        try { await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }); } catch (_) {}
    },
};
