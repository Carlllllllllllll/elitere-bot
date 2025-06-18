const mongoose = require('mongoose');
const TextSnippet = require('../models/TextSnippet');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    execute: async (interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const key = interaction.options.getString('key');
            const value = interaction.options.getString('value');

            await TextSnippet.findOneAndUpdate(
                { key },
                { value },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setTitle('Text Stored Successfully')
                .setDescription(`Key: ${key}\nValue: ${value}`)
                .setColor(0x2ecc71)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } 
        else if (subcommand === 'get') {
            const key = interaction.options.getString('key');
            const snippet = await TextSnippet.findOne({ key });

            if (!snippet) {
                return interaction.reply({ content: 'No text found with that key.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`Text for "${key}"`)
                .setDescription(snippet.value)
                .setColor(0x3498db)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'list') {
            const snippets = await TextSnippet.find();
            
            if (snippets.length === 0) {
                return interaction.reply({ content: 'No text snippets stored yet.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('All Stored Text Snippets')
                .setDescription(snippets.map(s => `**${s.key}**: ${s.value.substring(0, 50)}${s.value.length > 50 ? '...' : ''}`).join('\n\n'))
                .setColor(0x9b59b6)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};