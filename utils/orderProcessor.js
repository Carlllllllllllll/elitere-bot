const { Document, Paragraph, TextRun, AlignmentType, Packer, ImageRun, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const QRCode = require('qrcode');

class OrderProcessor {
    constructor(client) {
        this.client = client;
        this.orderChannelId = process.env.ORDER_CHANNEL_ID;
        this.outputChannelId = process.env.OUTPUT_CHANNEL_ID;
        
        if (!this.orderChannelId || !this.outputChannelId) {
            logger.error('MISSING REQUIRED ENV VARIABLES!');
            logger.error(`ORDER_CHANNEL_ID: ${this.orderChannelId ? 'SET' : 'MISSING'}`);
            logger.error(`OUTPUT_CHANNEL_ID: ${this.outputChannelId ? 'SET' : 'MISSING'}`);
            throw new Error('Missing required environment variables');
        }
        
        this.verifyChannels().catch(err => {
            logger.error('Channel verification failed:', err);
        });
    }
    
    async verifyChannels() {
        try {
            const orderChannel = await this.client.channels.fetch(this.orderChannelId);
            const outputChannel = await this.client.channels.fetch(this.outputChannelId);
        } catch (err) {
            logger.error('Failed to fetch channels - check permissions and IDs');
            throw err;
        }
    }

    async startListening() {
        this.client.on('messageCreate', async (message) => {
            try {
                if (message.channelId !== this.orderChannelId) return;
                if (message.author.bot && !message.webhookId) return;

                if (message.partial) {
                    try {
                        await message.fetch();
                    } catch (fetchError) {
                        logger.warn(`Could not fetch partial message ${message.id}: ${fetchError.message}`);
                        return;
                    }
                }

                if (this.isOrderMessage(message)) {
                    await this.processOrderMessage(message);
                }
            } catch (error) {
                logger.error(`Error in messageCreate handler: ${error.message}`);
            }
        });
    }

    isOrderMessage(message) {
        try {
            let content = '';
            
            if (message.embeds && message.embeds.length > 0) {
                if (message.embeds[0].description) {
                    content = message.embeds[0].description;
                } else if (message.embeds[0].fields) {
                    content = message.embeds[0].fields.map(f => `${f.name}: ${f.value}`).join('\n');
                }
            } else if (message.content) {
                content = message.content;
            }
    
            if (!content) return false;
    
            const orderKeywords = [
                '🛒 New Order Received',
                '👤 First Name',
                '📧 Email',
                '📍 Location',
                '🛍️ Cart Items',
                '💳 Payment Method',
                '💰 Total Price',
                '🆔 Order ID'
            ];

            const matches = orderKeywords.filter(keyword => content.includes(keyword));
            return matches.length >= 3;
        } catch (error) {
            logger.error(`Error checking if message is order: ${error.message}`);
            return false;
        }
    }

    async processOrderMessage(message) {
        if (!message) return;

        try {
            const orderDetails = this.extractOrderDetails(message);
            if (!orderDetails) return;

            const docBuffer = await this.generateDocument(orderDetails);
            if (!docBuffer) return;

            const outputChannel = await this.client.channels.fetch(this.outputChannelId).catch(err => {
                logger.error(`Failed to fetch output channel: ${err.message}`);
                return null;
            });

            if (!outputChannel) return;

            await outputChannel.send({
                content: `📦 Order sticker for ${orderDetails.firstName}'s Order (${orderDetails.orderId})`,
                files: [{
                    attachment: docBuffer,
                    name: `${orderDetails.orderId}.docx`
                }]
            });
        } catch (error) {
            logger.error(`Error processing order message: ${error.message}`);
        }
    }

    extractOrderDetails(message) {
        try {
            let content = '';
            if (message.embeds?.length > 0) {
                if (message.embeds[0].description) {
                    content = message.embeds[0].description;
                } else if (message.embeds[0].fields) {
                    content = message.embeds[0].fields.map(f => `${f.name}: ${f.value}`).join('\n');
                }
            } else {
                content = message.content;
            }

            if (!content) return null;

            const lines = content.split('\n');
            const details = {};

            for (const line of lines) {
                if (line.includes('👤 First Name')) details.firstName = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('👤 Last Name')) details.lastName = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('📧 Email')) details.email = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('📍 Location')) details.location = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('🏠 Street Name')) details.street = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('🏙️ City')) details.city = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('📞 Phone Number 1')) details.phone1 = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('📞 Phone Number 2')) details.phone2 = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('🛍️ Cart Items')) {
                    const itemsStart = content.indexOf('🛍️ Cart Items');
                    const paymentStart = content.indexOf('💳 Payment Method');
                    if (itemsStart !== -1 && paymentStart !== -1) {
                        details.items = content.substring(itemsStart, paymentStart)
                            .replace('🛍️ Cart Items:', '')
                            .replace(/\*/g, '')
                            .trim()
                            .split('\n')
                            .filter(item => item.trim() !== '');
                    }
                }
                if (line.includes('💳 Payment Method')) details.paymentMethod = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('💰 Shipping Fees')) details.shippingFees = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('🎟️ Promo Code Used')) details.promoCode = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('💰 Total Price')) details.totalPrice = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('🆔 Order ID')) details.orderId = this.cleanText(line.split(':')[1]?.trim());
                if (line.includes('👤 User ID')) details.userId = this.cleanText(line.split(':')[1]?.trim());
            }

            if (!details.firstName || !details.orderId) return null;
            return details;
        } catch (error) {
            logger.error(`Error extracting order details: ${error.message}`);
            return null;
        }
    }

    cleanText(text) {
        if (!text) return text;
        return text.replace(/\s+/g, ' ').trim();
    }

    async generateDocument(orderDetails) {
        try {
            const itemsArray = orderDetails.items || ['N/A'];
            const formattedItems = itemsArray.map(item => new Paragraph({
                children: [new TextRun({
                    text: item.startsWith('•') ? item : `• ${item.trim()}`,
                    size: 22,
                    font: 'Arial'
                })]
            }));

            const qrCodeData = await this.generateQRCode(orderDetails.orderId);
            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1000,
                                right: 1000,
                                bottom: 1000,
                                left: 1000
                            }
                        }
                    },
                    children: [

                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "ORDER RECEIPT",
                                    color: "000000",
                                    bold: true,
                                    size: 36,
                                    font: 'Arial Black'
                                })
                            ],
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 600 }
                        }),


                        new Paragraph({
                            children: [new TextRun({
                                text: `Order ID: ${orderDetails.orderId}`,
                                bold: true,
                                size: 24,
                                font: 'Arial'
                            })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 400 }
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: "CUSTOMER DETAILS",
                                bold: true,
                                size: 22,
                                font: 'Arial'
                            })],
                            spacing: { after: 200 }
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `👤 ${orderDetails.firstName} ${orderDetails.lastName || ''}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `📧 ${orderDetails.email || 'N/A'}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `📞 ${orderDetails.phone1 || 'N/A'} ${orderDetails.phone2 && orderDetails.phone2 !== 'N/A' ? `/ ${orderDetails.phone2}` : ''}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `📍 ${orderDetails.street || 'N/A'}, ${orderDetails.city || 'N/A'}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `🌍 ${orderDetails.location || 'N/A'}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            text: "",
                            spacing: { after: 400 }
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: "ORDER SUMMARY",
                                bold: true,
                                size: 22,
                                font: 'Arial'
                            })],
                            spacing: { after: 200 }
                        }),

                        ...formattedItems,

                        new Paragraph({
                            text: "",
                            spacing: { after: 200 }
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `💳 Payment: ${orderDetails.paymentMethod || 'N/A'}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `🚚 Shipping: ${orderDetails.shippingFees || 'N/A'}`,
                                size: 20,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: `💰 Total: ${orderDetails.totalPrice || 'N/A'}`,
                                size: 22,
                                bold: true,
                                font: 'Arial'
                            })]
                        }),

                        new Paragraph({
                            text: "",
                            spacing: { after: 600 }
                        }),

                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: qrCodeData,
                                    transformation: {
                                        width: 150,
                                        height: 150,
                                    },
                                })
                            ],
                            alignment: AlignmentType.CENTER,
                        }),

                    new Paragraph({
                            children: [new TextRun({
                                text: `${process.env.WEBSITE_URL2}`,
                                size: 21,
                                font: 'Arial'
                            })],
                            alignment: AlignmentType.CENTER
                        }),

                        new Paragraph({
                            children: [new TextRun({
                                text: "Thank you for your order!",
                                size: 24,
                                bold: true,
                                font: 'Arial'
                            })],
                            alignment: AlignmentType.CENTER
                        })

                    ]
                }]
            });

            return await Packer.toBuffer(doc);
        } catch (error) {
            logger.error(`Document generation failed: ${error.message}`);
            return null;
        }
    }

    async generateQRCode(orderId) {
        try {
            const url = process.env.WEBSITE_URL2;
            return await QRCode.toBuffer(url, { width: 200, margin: 2 });
        } catch (error) {
            logger.error(`QR code generation failed: ${error.message}`);
            return Buffer.from('');
        }
    }
}

module.exports = OrderProcessor;