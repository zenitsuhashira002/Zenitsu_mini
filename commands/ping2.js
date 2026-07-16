module.exports = {
    name: 'ping2',

    execute: async ({ sock, msg }) => {
        const from = msg.key.remoteJid

        const start = Date.now()
        let { key } = await sock.sendMessage(from, {text :'👻 Wait darling ...'})
        const end = Date.now()
        var lod = `*⚡ ${end - start} ms*`
        await sock.sendMessage(from, {
            text: lod,
            edit: key
        });

    }
}
