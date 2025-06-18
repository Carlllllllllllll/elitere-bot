const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (interaction) => {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: 'You need administrator permissions to manage whitelist.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        let whitelist = process.env.WHITELISTED_USERS.split(',');

        if (subcommand === 'add') {
            const user = interaction.options.getString('user');
            if (whitelist.includes(user)) {
                return interaction.reply({ content: 'User is already whitelisted.', ephemeral: true });
            }

            whitelist.push(user);
            process.env.WHITELISTED_USERS = whitelist.join(',');
            await interaction.reply({ content: `User ${user} added to whitelist.`, ephemeral: true });
        }
        else if (subcommand === 'remove') {
            const user = interaction.options.getString('user');
            if (!whitelist.includes(user)) {
                return interaction.reply({ content: 'User is not whitelisted.', ephemeral: true });
            }

            whitelist = whitelist.filter(id => id !== user);
            process.env.WHITELISTED_USERS = whitelist.join(',');
            await interaction.reply({ content: `User ${user} removed from whitelist.`, ephemeral: true });
        }
        else if (subcommand === 'list') {
            if (whitelist.length === 0) {
                return interaction.reply({ content: 'No users are whitelisted.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Whitelisted Users')
                .setDescription(whitelist.join('\n'))
                .setColor(0xf1c40f)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};