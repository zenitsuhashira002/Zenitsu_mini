'use strict';

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           COMMAND .status — CybernovA                   ║
 * ║   Full system diagnostic for Render-deployed bots       ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Sections covered:
 *   [1] Runtime    — Node.js version, uptime, PID, platform
 *   [2] Memory     — heap used/total, RSS, external, GC pressure
 *   [3] CPU        — load averages (1m / 5m / 15m), core count
 *   [4] Disk       — free/total on tmpdir (Render ephemeral FS)
 *   [5] Network    — outbound connectivity test (3 targets)
 *   [6] Render     — environment variables, dyno context
 *   [7] WhatsApp   — socket state, JID, store health
 *   [8] Commands   — loaded command count, aliases, duplicates
 *   [9] Mini-tests — latency ping, DNS resolution, JSON parse,
 *                    memory alloc/free, async pipeline
 *  [10] Verdict    — global health score & recommendations
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

let axios;
try { axios = require('axios'); } catch (_) {}

// ╔══════════════════════════════════════════════════════════╗
// ║                    CONFIGURATION                         ║
// ╚══════════════════════════════════════════════════════════╝

const CONFIG = {
    VERSION    : '1.0.0',
    CMD_NAME   : 'status',

    // Connectivity test targets (lightweight endpoints)
    PING_TARGETS: [
        { name: 'Google DNS',    url: 'https://dns.google/resolve?name=google.com&type=A' },
        { name: 'Cloudflare',    url: 'https://1.1.1.1/dns-query?name=cloudflare.com&type=A',
          headers: { Accept: 'application/dns-json' } },
        { name: 'GitHub API',    url: 'https://api.github.com' }
    ],

    // Render environment variable names
    RENDER_ENV_KEYS: [
        'RENDER', 'RENDER_SERVICE_NAME', 'RENDER_SERVICE_ID',
        'RENDER_INSTANCE_ID', 'RENDER_GIT_COMMIT', 'RENDER_GIT_BRANCH',
        'RENDER_EXTERNAL_URL', 'PORT'
    ],

    // Thresholds for health evaluation
    THRESHOLDS: {
        HEAP_WARN_MB   : 350,
        HEAP_CRIT_MB   : 450,
        RSS_WARN_MB    : 450,
        LOAD_WARN      : 1.5,
        LOAD_CRIT      : 2.5,
        LATENCY_WARN_MS: 800,
        LATENCY_CRIT_MS: 2000,
        DISK_WARN_MB   : 100
    },

    NEWSLETTER: {
        jid            : '120363425394543602@newsletter',
        name           : '모🅒🅨🅑🅔🅡🅝🅞🅥🅐 🌟',
        serverMessageId: 195
    }
};

// ╔══════════════════════════════════════════════════════════╗
// ║                      UTILITIES                           ║
// ╚══════════════════════════════════════════════════════════╝

const mb       = (bytes)  => (bytes / 1024 / 1024).toFixed(1);
const pct      = (a, b)   => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0';
const pad      = (s, n)   => String(s).padEnd(n);
const ms       = (start)  => (performance.now() - start).toFixed(0);
const truncate = (s, max) => s?.length > max ? s.substring(0, max) + '…' : (s ?? '—');

/** Human-readable uptime from seconds */
const formatUptime = (sec) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
};

/** Status badge based on threshold */
const badge = (value, warn, crit, invert = false) => {
    if (invert) {
        if (value <= crit) return '🔴';
        if (value <= warn) return '🟡';
        return '🟢';
    }
    if (value >= crit) return '🔴';
    if (value >= warn) return '🟡';
    return '🟢';
};

const contextInfo = (from) => ({
    mentionedJid: [from],
    forwardingScore: 540,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid      : CONFIG.NEWSLETTER.jid,
        newsletterName     : CONFIG.NEWSLETTER.name,
        serverMessageId    : CONFIG.NEWSLETTER.serverMessageId
    }
});

// ╔══════════════════════════════════════════════════════════╗
// ║                    DIAGNOSTIC MODULES                    ║
// ╚══════════════════════════════════════════════════════════╝

// ── [1] Runtime ────────────────────────────────────────────────────
const getRuntime = () => {
    const upSec  = process.uptime();
    const nodeVer = process.version;
    const [major] = nodeVer.replace('v', '').split('.').map(Number);

    return {
        node    : nodeVer,
        nodeOk  : major >= 18,
        platform: process.platform,
        arch    : process.arch,
        pid     : process.pid,
        uptime  : formatUptime(upSec),
        uptimeSec: upSec,
        env     : process.env.NODE_ENV ?? 'not set',
        execPath: truncate(process.execPath, 40)
    };
};

// ── [2] Memory ─────────────────────────────────────────────────────
const getMemory = () => {
    const mem     = process.memoryUsage();
    const heapMb  = parseFloat(mb(mem.heapUsed));
    const heapTot = parseFloat(mb(mem.heapTotal));
    const rssMb   = parseFloat(mb(mem.rss));
    const extMb   = parseFloat(mb(mem.external));
    const sysFree = parseFloat(mb(os.freemem()));
    const sysTotal= parseFloat(mb(os.totalmem()));

    return {
        heapUsed : heapMb,
        heapTotal: heapTot,
        heapPct  : pct(mem.heapUsed, mem.heapTotal),
        rss      : rssMb,
        external : extMb,
        sysFree,
        sysTotal,
        sysPct   : pct(os.totalmem() - os.freemem(), os.totalmem()),
        badge    : badge(heapMb,
            CONFIG.THRESHOLDS.HEAP_WARN_MB,
            CONFIG.THRESHOLDS.HEAP_CRIT_MB)
    };
};

// ── [3] CPU ────────────────────────────────────────────────────────
const getCpu = () => {
    const loads = os.loadavg();
    const cores = os.cpus().length;
    const model = os.cpus()[0]?.model?.trim() ?? 'Unknown';

    return {
        load1   : loads[0].toFixed(2),
        load5   : loads[1].toFixed(2),
        load15  : loads[2].toFixed(2),
        cores,
        model   : truncate(model, 35),
        badge   : badge(loads[0],
            CONFIG.THRESHOLDS.LOAD_WARN,
            CONFIG.THRESHOLDS.LOAD_CRIT)
    };
};

// ── [4] Disk (ephemeral Render FS via os.tmpdir) ───────────────────
const getDisk = () => {
    try {
        const tmp    = os.tmpdir();
        const stat   = fs.statfsSync?.(tmp);   // Node 19+

        if (!stat) {
            // Fallback: measure available write space via a temp file probe
            const probe = path.join(tmp, `.probe_${Date.now()}`);
            fs.writeFileSync(probe, 'x');
            fs.unlinkSync(probe);
            return { supported: false, writable: true, path: tmp };
        }

        const freeMb  = parseFloat(mb(stat.bfree  * stat.bsize));
        const totalMb = parseFloat(mb(stat.blocks * stat.bsize));
        const usedMb  = totalMb - freeMb;

        return {
            supported: true,
            writable : true,
            path     : tmp,
            freeMb,
            totalMb,
            usedMb,
            usedPct  : pct(usedMb, totalMb),
            badge    : badge(freeMb,
                CONFIG.THRESHOLDS.DISK_WARN_MB, 10, true)
        };
    } catch (err) {
        return { supported: false, writable: false, error: err.message };
    }
};

// ── [5] Network connectivity ───────────────────────────────────────
const getNetwork = async () => {
    if (!axios) {
        return { available: false, reason: 'axios not installed' };
    }

    const results = [];

    for (const target of CONFIG.PING_TARGETS) {
        const t0 = performance.now();
        try {
            await axios.get(target.url, {
                timeout: 5000,
                headers: target.headers ?? {
                    'User-Agent': 'CybernovA-StatusBot/1.0'
                },
                validateStatus: (s) => s < 500
            });
            const latency = parseFloat(ms(t0));
            results.push({
                name   : target.name,
                ok     : true,
                latency,
                badge  : badge(latency,
                    CONFIG.THRESHOLDS.LATENCY_WARN_MS,
                    CONFIG.THRESHOLDS.LATENCY_CRIT_MS)
            });
        } catch (err) {
            results.push({
                name   : target.name,
                ok     : false,
                latency: null,
                error  : truncate(err.message, 35)
            });
        }
    }

    const allOk   = results.every((r) => r.ok);
    const anyOk   = results.some((r) => r.ok);
    const avgLat  = results
        .filter((r) => r.ok && r.latency)
        .reduce((a, r, _, arr) => a + r.latency / arr.length, 0)
        .toFixed(0);

    return { results, allOk, anyOk, avgLatency: avgLat };
};

// ── [6] Render environment ─────────────────────────────────────────
const getRenderEnv = () => {
    const isRender   = !!process.env.RENDER;
    const detected   = {};

    for (const key of CONFIG.RENDER_ENV_KEYS) {
        const val = process.env[key];
        if (val) detected[key] = truncate(val, 40);
    }

    // Bot-specific env check
    const botKeys    = ['BOT_NAME', 'PREFIX', 'OWNER_NUMBER',
                        'SESSION_ID', 'MONGO_URI', 'DATABASE_URL'];
    const botEnv     = {};
    for (const key of botKeys) {
        const val = process.env[key];
        botEnv[key] = val ? '✅ set' : '⚠️  missing';
    }

    return { isRender, detected, botEnv, totalEnvKeys: Object.keys(process.env).length };
};

// ── [7] WhatsApp socket health ─────────────────────────────────────
const getSocketHealth = (sock) => {
    if (!sock) return { available: false };

    const state = sock.ws?.readyState;
    const states = { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' };

    return {
        available  : true,
        wsState    : states[state] ?? `UNKNOWN(${state})`,
        wsOk       : state === 1,
        jid        : truncate(sock.user?.id ?? 'not authenticated', 30),
        name       : sock.user?.name ?? '—',
        platform   : sock.user?.platform ?? '—',
        storeLoaded: !!sock.store || !!global.store
    };
};

// ── [8] Commands registry ──────────────────────────────────────────
const getCommandsInfo = (commands) => {
    if (!commands) return { available: false };

    const cmds     = [...(commands.values?.() ?? commands)];
    const names    = cmds.map((c) => c.name).filter(Boolean);
    const aliases  = cmds.flatMap((c) => c.aliases ?? []);
    const dupes    = names.filter((n, i) => names.indexOf(n) !== i);

    return {
        available : true,
        total     : names.length,
        aliases   : aliases.length,
        duplicates: dupes,
        sample    : names.slice(0, 8).join(', ')
    };
};

// ── [9] Mini functional tests ──────────────────────────────────────
const runMiniTests = async () => {
    const tests = [];

    // Test 1: JSON parse/stringify roundtrip
    (() => {
        const t0  = performance.now();
        try {
            const obj = { a: 1, b: [2, 3], c: { d: 'hello' } };
            const str = JSON.stringify(obj);
            const out = JSON.parse(str);
            const ok  = out.c.d === 'hello';
            tests.push({ name: 'JSON roundtrip',  ok, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'JSON roundtrip',  ok: false, error: e.message });
        }
    })();

    // Test 2: Buffer allocation & GC
    (() => {
        const t0 = performance.now();
        try {
            const buf = Buffer.allocUnsafe(1024 * 1024); // 1 MB
            buf.fill(0x42);
            const ok  = buf[0] === 0x42 && buf.length === 1024 * 1024;
            tests.push({ name: 'Buffer alloc 1MB', ok, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'Buffer alloc 1MB', ok: false, error: e.message });
        }
    })();

    // Test 3: Async/await pipeline
    await (async () => {
        const t0 = performance.now();
        try {
            const results = await Promise.all([
                Promise.resolve(1),
                Promise.resolve(2),
                new Promise((r) => setTimeout(() => r(3), 10))
            ]);
            const ok = results[2] === 3;
            tests.push({ name: 'Async pipeline',   ok, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'Async pipeline',   ok: false, error: e.message });
        }
    })();

    // Test 4: File system write/read/delete on tmpdir
    await (async () => {
        const t0   = performance.now();
        const file = path.join(os.tmpdir(), `.syscheck_${Date.now()}`);
        try {
            fs.writeFileSync(file, 'CybernovA');
            const content = fs.readFileSync(file, 'utf8');
            fs.unlinkSync(file);
            const ok = content === 'CybernovA';
            tests.push({ name: 'FS write/read/del', ok, latency: ms(t0) });
        } catch (e) {
            if (fs.existsSync(file)) try { fs.unlinkSync(file); } catch (_) {}
            tests.push({ name: 'FS write/read/del', ok: false, error: e.message });
        }
    })();

    // Test 5: Regex engine
    (() => {
        const t0 = performance.now();
        try {
            const re  = /^[\w.-]+@[\w.-]+\.[a-z]{2,}$/i;
            const ok  = re.test('bot@cybernova.io') && !re.test('invalid@');
            tests.push({ name: 'Regex engine',      ok, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'Regex engine',      ok: false, error: e.message });
        }
    })();

    // Test 6: EventEmitter
    await (async () => {
        const t0 = performance.now();
        try {
            const { EventEmitter } = require('events');
            const ee  = new EventEmitter();
            let fired = false;
            ee.once('ping', () => { fired = true; });
            ee.emit('ping');
            tests.push({ name: 'EventEmitter',      ok: fired, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'EventEmitter',      ok: false, error: e.message });
        }
    })();

    // Test 7: Crypto (Node built-in)
    (() => {
        const t0 = performance.now();
        try {
            const crypto = require('crypto');
            const hash   = crypto.createHash('sha256').update('CybernovA').digest('hex');
            const ok     = hash.length === 64;
            tests.push({ name: 'Crypto SHA-256',    ok, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'Crypto SHA-256',    ok: false, error: e.message });
        }
    })();

    // Test 8: HTTP outbound (axios quick ping)
    await (async () => {
        if (!axios) {
            tests.push({ name: 'HTTP outbound',     ok: false, error: 'axios missing' });
            return;
        }
        const t0 = performance.now();
        try {
            await axios.head('https://httpbin.org/status/200', { timeout: 4000 });
            tests.push({ name: 'HTTP outbound',     ok: true, latency: ms(t0) });
        } catch (e) {
            tests.push({ name: 'HTTP outbound',     ok: false, error: truncate(e.message, 30) });
        }
    })();

    const passed = tests.filter((t) => t.ok).length;
    const failed = tests.filter((t) => !t.ok).length;

    return { tests, passed, failed, total: tests.length };
};

// ── [10] Global verdict ────────────────────────────────────────────
const computeVerdict = ({ memory, cpu, network, socket, miniTests }) => {
    const issues = [];
    const tips   = [];
    let   score  = 100;

    // Memory
    if (memory.heapUsed >= CONFIG.THRESHOLDS.HEAP_CRIT_MB) {
        score -= 25; issues.push('Critical heap usage — consider restart');
    } else if (memory.heapUsed >= CONFIG.THRESHOLDS.HEAP_WARN_MB) {
        score -= 10; tips.push('Heap approaching limit — monitor closely');
    }

    // CPU
    if (parseFloat(cpu.load1) >= CONFIG.THRESHOLDS.LOAD_CRIT) {
        score -= 20; issues.push('Critical CPU load detected');
    } else if (parseFloat(cpu.load1) >= CONFIG.THRESHOLDS.LOAD_WARN) {
        score -= 8; tips.push('CPU load elevated — check active tasks');
    }

    // Network
    if (!network.anyOk) {
        score -= 30; issues.push('No outbound connectivity — bot isolated');
    } else if (!network.allOk) {
        score -= 10; tips.push('Some network targets unreachable');
    }

    // WhatsApp socket
    if (socket.available && !socket.wsOk) {
        score -= 20; issues.push('WhatsApp socket not OPEN — reconnection needed');
    }

    // Mini-tests
    if (miniTests.failed > 0) {
        score -= miniTests.failed * 5;
        issues.push(`${miniTests.failed} mini-test(s) failed`);
    }

    score = Math.max(0, score);

    const level = score >= 90 ? { label: 'EXCELLENT', icon: '🟢' }
                : score >= 70 ? { label: 'GOOD',      icon: '🟡' }
                : score >= 45 ? { label: 'DEGRADED',  icon: '🟠' }
                :               { label: 'CRITICAL',  icon: '🔴' };

    return { score, level, issues, tips };
};

// ╔══════════════════════════════════════════════════════════╗
// ║                MESSAGE BUILDER                           ║
// ╚══════════════════════════════════════════════════════════╝

const buildReport = (data) => {
    const { runtime, memory, cpu, disk, network, renderEnv,
            socket, commands, miniTests, verdict, scanMs } = data;

    const line = '┃';
    const sep  = `${line}\n`;

    // ── Section helpers ──
    const section = (icon, title) =>
        `${line}\n${line}  ${icon} *${title}*\n${line}`;

    const row = (label, value) =>
        `${line}  ${pad(label, 17)} ${value}`;

    // ── [1] Runtime ──
    const runtimeBlock = [
        section('🖥️', 'RUNTIME'),
        row('Node.js',    `${runtime.node} ${runtime.nodeOk ? '✅' : '⚠️ (<18)'}`),
        row('Platform',   `${runtime.platform} / ${runtime.arch}`),
        row('PID',        runtime.pid),
        row('Uptime',     runtime.uptime),
        row('Environment',runtime.env)
    ].join('\n');

    // ── [2] Memory ──
    const memBlock = [
        section('🧠', 'MEMORY'),
        row('Heap used',  `${memory.heapUsed} MB / ${memory.heapTotal} MB (${memory.heapPct}%) ${memory.badge}`),
        row('RSS',        `${memory.rss} MB`),
        row('External',   `${memory.external} MB`),
        row('System RAM', `${memory.sysFree} MB free / ${memory.sysTotal} MB (${memory.sysPct}% used)`)
    ].join('\n');

    // ── [3] CPU ──
    const cpuBlock = [
        section('⚙️', 'CPU'),
        row('Load avg',   `${cpu.load1} / ${cpu.load5} / ${cpu.load15} ${cpu.badge}`),
        row('Cores',      cpu.cores),
        row('Model',      cpu.model)
    ].join('\n');

    // ── [4] Disk ──
    const diskBlock = (() => {
        const rows = [section('💾', 'DISK (Render tmpdir)')];
        if (!disk.supported) {
            rows.push(row('Write test', disk.writable ? '✅ writable' : `❌ ${disk.error}`));
        } else {
            rows.push(row('Free',  `${disk.freeMb} MB / ${disk.totalMb} MB ${disk.badge}`));
            rows.push(row('Used',  `${disk.usedMb} MB (${disk.usedPct}%)`));
            rows.push(row('Path',  disk.path));
        }
        return rows.join('\n');
    })();

    // ── [5] Network ──
    const netBlock = (() => {
        const rows = [section('🌐', 'NETWORK')];
        if (!network.available) {
            rows.push(row('Status', `❌ ${network.reason}`));
        } else {
            for (const r of network.results) {
                const tag = r.ok ? `${r.badge} ${r.latency}ms` : `🔴 ${r.error}`;
                rows.push(row(r.name, tag));
            }
            if (network.anyOk) {
                rows.push(row('Avg latency', `${network.avgLatency}ms`));
            }
        }
        return rows.join('\n');
    })();

    // ── [6] Render env ──
    const renderBlock = (() => {
        const rows = [section('☁️', 'RENDER ENVIRONMENT')];
        rows.push(row('Detected',    renderEnv.isRender ? '✅ Running on Render' : '⚠️  Not Render env'));
        rows.push(row('Service',     renderEnv.detected.RENDER_SERVICE_NAME  ?? '—'));
        rows.push(row('Branch',      renderEnv.detected.RENDER_GIT_BRANCH    ?? '—'));
        rows.push(row('Commit',      truncate(renderEnv.detected.RENDER_GIT_COMMIT ?? '—', 12)));
        rows.push(row('Ext. URL',    truncate(renderEnv.detected.RENDER_EXTERNAL_URL ?? '—', 28)));
        rows.push(row('PORT',        renderEnv.detected.PORT                 ?? '—'));
        rows.push(row('Total vars',  renderEnv.totalEnvKeys));
        rows.push(`${line}`);
        rows.push(`${line}  *Bot env keys :*`);
        for (const [k, v] of Object.entries(renderEnv.botEnv)) {
            rows.push(row(k, v));
        }
        return rows.join('\n');
    })();

    // ── [7] WhatsApp socket ──
    const wsBlock = (() => {
        const rows = [section('📱', 'WHATSAPP SOCKET')];
        if (!socket.available) {
            rows.push(row('Status', '⚠️  sock not passed to command'));
        } else {
            rows.push(row('WS State',   `${socket.wsOk ? '🟢' : '🔴'} ${socket.wsState}`));
            rows.push(row('JID',        socket.jid));
            rows.push(row('Name',       socket.name));
            rows.push(row('Platform',   socket.platform));
            rows.push(row('Store',      socket.storeLoaded ? '✅ loaded' : '⚠️  not found'));
        }
        return rows.join('\n');
    })();

    // ── [8] Commands ──
    const cmdsBlock = (() => {
        const rows = [section('📦', 'COMMANDS REGISTRY')];
        if (!commands.available) {
            rows.push(row('Status', '⚠️  commands map not passed'));
        } else {
            rows.push(row('Loaded',     commands.total));
            rows.push(row('Aliases',    commands.aliases));
            rows.push(row('Duplicates', commands.duplicates.length > 0
                ? `⚠️  ${commands.duplicates.join(', ')}`
                : '✅ none'));
            rows.push(row('Sample',     truncate(commands.sample, 30)));
        }
        return rows.join('\n');
    })();

    // ── [9] Mini-tests ──
    const testBlock = (() => {
        const rows = [section('🧪', 'MINI TESTS')];
        for (const t of miniTests.tests) {
            const icon = t.ok ? '✅' : '❌';
            const info = t.ok ? `${t.latency}ms` : (t.error ?? 'failed');
            rows.push(row(t.name, `${icon} ${info}`));
        }
        rows.push(sep);
        rows.push(row('Result', `${miniTests.passed}/${miniTests.total} passed ${
            miniTests.failed === 0 ? '🟢' : miniTests.failed <= 2 ? '🟡' : '🔴'
        }`));
        return rows.join('\n');
    })();

    // ── [10] Verdict ──
    const verdictBlock = (() => {
        const rows = [section('📊', 'SYSTEM VERDICT')];
        rows.push(row('Health score', `${verdict.score}/100 ${verdict.level.icon}`));
        rows.push(row('Status',       `${verdict.level.icon} ${verdict.level.label}`));
        rows.push(row('Scan time',    `${scanMs}ms`));
        if (verdict.issues.length > 0) {
            rows.push(sep);
            rows.push(`${line}  ⚠️  *Issues detected :*`);
            for (const issue of verdict.issues) rows.push(`${line}  • ${issue}`);
        }
        if (verdict.tips.length > 0) {
            rows.push(sep);
            rows.push(`${line}  💡 *Recommendations :*`);
            for (const tip of verdict.tips) rows.push(`${line}  • ${tip}`);
        }
        if (verdict.issues.length === 0 && verdict.tips.length === 0) {
            rows.push(`${line}  ✅ All systems operating normally`);
        }
        return rows.join('\n');
    })();

    return (
`╭━━━━❲ *SYSTEM STATUS* ❳━━━━╮
${runtimeBlock}
${sep}${memBlock}
${sep}${cpuBlock}
${sep}${diskBlock}
${sep}${netBlock}
${sep}${renderBlock}
${sep}${wsBlock}
${sep}${cmdsBlock}
${sep}${testBlock}
${sep}${verdictBlock}
${line}
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`
    );
};

// ╔══════════════════════════════════════════════════════════╗
// ║                   EXPORTED MODULE                        ║
// ╚══════════════════════════════════════════════════════════╝

module.exports = {
    name       : 'status',
    aliases    : ['sys', 'system', 'health', 'ping', 'info', 'diagnostic', 'diag'],
    description: 'Full system diagnostic — runtime, memory, CPU, network, Render env & mini-tests',

    async execute({ sock, msg, args, jid, commands }) {
        const from = jid || msg?.key?.remoteJid;

        if (!from) {
            console.error('❌ JID not available');
            return;
        }

        const react = async (emoji) => {
            if (msg?.key) {
                await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
            }
        };

        const reply = (text, withCtx = false) =>
            sock.sendMessage(
                from,
                { text, ...(withCtx && { contextInfo: contextInfo(from) }) },
                { quoted: msg }
            );

        // ── Help ─────────────────────────────────────────────────────
        if (args[0]?.toLowerCase() === 'help') {
            await react('📋');
            return reply(
`╭━━━━❲ *SYSTEM STATUS* ❳━━━━╮
┃
┃  🔍 *What it checks :*
┃  • Node.js runtime & uptime
┃  • Memory (heap, RSS, system)
┃  • CPU load averages
┃  • Disk (Render tmpdir)
┃  • Network connectivity (3x)
┃  • Render environment vars
┃  • WhatsApp socket state
┃  • Commands registry
┃  • 8 live mini-tests
┃  • Global health verdict
┃
┃  📌 *Usage :*
┃  .status
┃  .status help
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

━━━━━━━━━━━━━━━
_©CybernovA_`,
                true
            );
        }

        // ── Scan begins ──────────────────────────────────────────────
        await react('🔍');
        await reply('🔍 *Running full system diagnostic…*\n\n⏳ Scanning all modules, please wait.');

        const scanStart = performance.now();

        // ── Collect all data (network & tests run in parallel) ───────
        const [network, miniTests] = await Promise.all([
            getNetwork(),
            runMiniTests()
        ]);

        const runtime   = getRuntime();
        const memory    = getMemory();
        const cpu       = getCpu();
        const disk      = getDisk();
        const renderEnv = getRenderEnv();
        const socket    = getSocketHealth(sock);
        const cmds      = getCommandsInfo(commands ?? global.commands ?? null);
        const scanMs    = parseFloat((performance.now() - scanStart).toFixed(0));

        const verdict = computeVerdict({ memory, cpu, network, socket, miniTests });

        // ── Build & send report ──────────────────────────────────────
        try {
            const report = buildReport({
                runtime, memory, cpu, disk, network,
                renderEnv, socket, commands: cmds,
                miniTests, verdict, scanMs
            });

            await react(
                verdict.score >= 90 ? '✅' :
                verdict.score >= 70 ? '🟡' :
                verdict.score >= 45 ? '🟠' : '🔴'
            );

            await sock.sendMessage(from, {
                text: report,
                contextInfo: contextInfo(from)
            }, { quoted: msg });

        } catch (err) {
            console.error('❌ Status report error:', err);
            await react('💥');
            await reply(
`╭━━━━❲ *REPORT ERROR* ❳━━━━╮
┃
┃  ❌ Failed to build report
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
