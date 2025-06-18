require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildInvites 
    ] 
});

const { connectDB } = require('./utils/db');
const statusCommand = require('./commands/status');
const purgeCommand = require('./commands/purge');
const storeCommand = require('./commands/store');
const calculateCommand = require('./commands/calculate');
const whitelistCommand = require('./commands/whitelist');
const OrderProcessor = require('./utils/orderProcessor');
const { startMonitoring } = require('./utils/websiteMonitor');
const { Document, Paragraph, TextRun, AlignmentType, Packer } = require('docx');
const fs = require('fs');
const path = require('path');

connectDB();

const activities = [
    { name: 'Elitère Store', type: ActivityType.Watching }
];

let currentActivity = 0;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    updateActivity();
    startMonitoring(client);
    const orderProcessor = new OrderProcessor(client);
    orderProcessor.startListening();
    setInterval(updateActivity, 180000);
const whitelistChecker = setInterval(async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const members = await guild.members.fetch();
        const whitelistedUsers = process.env.WHITELISTED_USERS.split(',');

        for (const member of members.values()) {
            if (member.user.bot) continue;
            
            if (!whitelistedUsers.includes(member.id)) {
                let inviteUsed = null;
                try {
                    const invites = await guild.invites.fetch();
                    for (const invite of invites.values()) {
                        if (invite.uses > 0) {
                            inviteUsed = invite;
                            break;
                        }
                    }
                } catch (inviteError) {
                    console.error('Error checking invites:', inviteError);
                }

                try {
                    await member.ban({ reason: 'Not whitelisted' });

                    if (inviteUsed) {
                        try {
                            await inviteUsed.delete('Used by non-whitelisted user');
                        } catch (deleteError) {
                            console.error('Failed to delete invite:', deleteError);
                        }
                    }

                    try {
                        const owner = await client.users.fetch('1365737993264173136');
                        await owner.send({
                            content: `Banned non-whitelisted user: ${member.user.tag} (${member.id})`,
                            allowedMentions: { users: [] }
                        }).catch(dmError => {
                        });
                    } catch (fetchError) {
                        console.error('Error fetching owner:', fetchError);
                    }
                } catch (banError) {
                    console.error(`Failed to ban ${member.user.tag}:`, banError);
                }
            }
        }
    } catch (error) {
        console.error('Error in whitelist checker:', error);
    }
}, 1000);

client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;
    
    const whitelistedUsers = process.env.WHITELISTED_USERS.split(',');
    if (!whitelistedUsers.includes(member.id)) {
        try {
            await member.ban({ reason: 'Not whitelisted' });

            try {
                const owner = await client.users.fetch('1365737993264173136');
                await owner.send({
                    content: `Banned non-whitelisted user who just joined: ${member.user.tag} (${member.id})`,
                    allowedMentions: { users: [] }
                }).catch(dmError => {
                });
            } catch (fetchError) {
                console.error('Error fetching owner:', fetchError);
            }
        } catch (banError) {
            console.error(`Failed to ban new member ${member.user.tag}:`, banError);
        }
    }
});
});

function updateActivity() {
    client.user.setActivity(activities[currentActivity]);
    currentActivity = (currentActivity + 1) % activities.length;
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const whitelisted = process.env.WHITELISTED_USERS.split(',').includes(interaction.user.id);
    if (!whitelisted && interaction.commandName !== 'whitelist') {
        return interaction.reply({ content: 'You are not whitelisted to use this bot.', ephemeral: true });
    }

    try {
        switch (interaction.commandName) {
            case 'status':
                await statusCommand.execute(interaction);
                break;
            case 'purge':
                await purgeCommand.execute(interaction);
                break;
            case 'store':
                await storeCommand.execute(interaction);
                break;
            case 'calculate':
                await calculateCommand.execute(interaction);
                break;
            case 'whitelist':
                await whitelistCommand.execute(interaction);
                break;
        }
    } catch (error) {
        console.error(error);
        interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
    }
});


async function registerCommands() {
    const commands = [     
        {
            name: 'status',
            description: 'Check website status and visitor statistics'
        },
        {
          name: 'purge',
          description: 'Purge messages in this channel',
          options: [
              {
                  name: 'amount',
                  description: 'Number of messages to delete (1-100)',
                  type: 4, 
                  required: false
              }
          ]
      },
        {
            name: 'store',
            description: 'Store or retrieve text snippets',
            options: [
                {
                    name: 'add',
                    description: 'Add a new text snippet',
                    type: 1,
                    options: [
                        {
                            name: 'key',
                            description: 'Identifier for the text',
                            type: 3,
                            required: true
                        },
                        {
                            name: 'value',
                            description: 'Text content to store',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'get',
                    description: 'Get a stored text snippet',
                    type: 1,
                    options: [
                        {
                            name: 'key',
                            description: 'Identifier for the text',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all stored text snippets',
                    type: 1
                }
            ]
        },
        {
            name: 'calculate',
            description: 'Calculate percentages for sales/profits',
            options: [
                {
                    name: 'original',
                    description: 'Original value',
                    type: 10,
                    required: true
                },
                {
                    name: 'current',
                    description: 'Current value',
                    type: 10,
                    required: true
                }
            ]
        },
        {
            name: 'whitelist',
            description: 'Manage whitelisted users',
            options: [
                {
                    name: 'add',
                    description: 'Add a user to whitelist',
                    type: 1,
                    options: [
                        {
                            name: 'user',
                            description: 'User ID to whitelist',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove a user from whitelist',
                    type: 1,
                    options: [
                        {
                            name: 'user',
                            description: 'User ID to remove',
                            type: 3,
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all whitelisted users',
                    type: 1
                }
            ]
        }
    ];

    await client.application.commands.set(commands);
    console.log('Commands registered successfully');
}

client.login(process.env.DISCORD_TOKEN).then(registerCommands);