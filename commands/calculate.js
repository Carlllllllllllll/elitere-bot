const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (interaction) => {
        const original = interaction.options.getNumber('original');
        const current = interaction.options.getNumber('current');
        
        const difference = current - original;
        const percentage = (difference / original) * 100;
        const isProfit = difference >= 0;

        const embed = new EmbedBuilder()
            .setTitle('Percentage Calculation')
            .setDescription(isProfit ? '📈 Profit Calculation' : '📉 Loss Calculation')
            .addFields(
                { name: 'Original Value', value: original.toFixed(2), inline: true },
                { name: 'Current Value', value: current.toFixed(2), inline: true },
                { name: 'Difference', value: difference.toFixed(2), inline: true },
                { name: 'Percentage', value: `${percentage.toFixed(2)}%`, inline: true }
            )
            .setColor(isProfit ? 0x2ecc71 : 0xe74c3c)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};