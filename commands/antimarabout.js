const antideleteModule = require('../events/antimarabout');

module.exports = {
    name: 'antimarabout',
    aliases: ['marabout'],
    category: 'owner',
    execute: async ({ sock, msg, args, jid }) => {
        await antideleteModule.command(sock, msg, args, jid);
    },
};
