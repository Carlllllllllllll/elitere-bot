const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (interaction) => {
        try {
            const start = Date.now();
            const response = await axios.get(process.env.WEBSITE_URL, { timeout: 10000 });
            const latency = Date.now() - start;
            
            let status;
            if (latency < 500) status = 'Excellent ⚡';
            else if (latency < 1000) status = 'Good ✅';
            else if (latency < 3000) status = 'Fair ⚠️';
            else status = 'Poor 🐢';

            const embed = new EmbedBuilder()
                .setTitle('Elitère Website Status')
                .setDescription(`Monitoring: ${process.env.WEBSITE_URL}`)
                .addFields(
                    { name: 'Status', value: status, inline: true },
                    { name: 'Latency', value: `${latency}ms`, inline: true },
                    { name: 'HTTP Status', value: response.status.toString(), inline: true }
                )
                .setColor(0x3498db)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setTitle('Elitère Website Status')
                .setDescription('⚠️ Website is currently down or unreachable ⚠️')
                .setColor(0xe74c3c)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};