module.exports = {
    name: 'ping',

    execute: async ({ sock, msg }) => {
        const from = msg.key.remoteJid

        const start = Date.now()

        await sock.sendMessage(from, {
            text: 'Pinging...'
        })

        const end = Date.now()

        await sock.sendMessage(
            from,
            {
                text: `*⚡ ${end - start} ms*`
            },
            {
                quoted: msg
            }
        )
    }
}
