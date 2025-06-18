const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (interaction) => {
        await interaction.deferReply({ ephemeral: true });

        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.editReply({ content: '❌ You need the "Manage Messages" permission to use this command.' });
        }

        const amount = interaction.options.getInteger('amount') || 100;

        if (amount < 1 || amount > 100) {
            return interaction.editReply({ content: '❌ Please provide a number between 1 and 100.' });
        }

        try {
            const messages = await interaction.channel.bulkDelete(amount, true);
            
            const embed = new EmbedBuilder()
                .setTitle('✅ Messages Purged')
                .setDescription(`Successfully deleted ${messages.size} messages`)
                .setColor(0x2ecc71)
                .setFooter({ text: `Executed by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            setTimeout(() => interaction.deleteReply().catch(console.error), 5000);
        } catch (error) {
            console.error('Purge error:', error);
            interaction.editReply({ content: `❌ Error purging messages: ${error.message}` });
        }
    }
};