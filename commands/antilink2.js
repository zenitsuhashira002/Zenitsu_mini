// ./commands/antilink.js

const antilinkModule = require('../events/antilink2');

module.exports = {
    name: 'antilink2',
    aliases: ['antilien', 'nolinks', 'nolink'],
    category: 'group',

    execute: async ({ sock, msg, args, jid }) => {
        await antilinkModule.command(sock, msg, args, jid);
    },
};

