// ./commands/quiz.js

const quizModule = require('../events/quiz');

module.exports = {
    name: 'quiz',
    aliases: ['quizz', 'qu'],
    category: 'fun',
    execute: async (ctx) => {
        await quizModule.command(ctx.sock, ctx.msg, ctx.args, ctx.jid);
    },
};
