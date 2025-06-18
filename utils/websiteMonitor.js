const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    startMonitoring: async (client) => {
        const channelId = process.env.STATUS_CHANNEL_ID; 
        const mentionUserId = '1126336222206365696'; 
        
        setInterval(async () => {
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel) {
                    console.error('Status channel not found');
                    return;
                }

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

                await channel.send({ embeds: [embed] });
            } catch (error) {
                const channel = await client.channels.fetch(channelId);
                if (!channel) {
                    console.error('Status channel not found');
                    return;
                }
                
                await channel.send(`<@${mentionUserId}>`);
                
                const embed = new EmbedBuilder()
                    .setTitle('Elitère Website Status')
                    .setDescription('⚠️ Website is currently down or unreachable ⚠️')
                    .setColor(0xe74c3c)
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }
        }, 300000); 
    }
};
