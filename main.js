require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Developer watermark
const DEV_WATERMARK = 'Made by 👩‍💻《D4X3D》';

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Track user states
const userStates = new Map();

// Helper function to download file
async function downloadFile(url, localPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// Helper function to delete file
function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
    }
}

// Restrict access to admin only
const restrictToAdmin = (msg, callback) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) {
        bot.sendMessage(chatId, `⛔ Access denied. This bot is for administrators only.\n\n${DEV_WATERMARK}`);
        return;
    }
    callback();
};

// Main menu keyboard
const getMainKeyboard = () => {
    return {
        keyboard: [
            [{ text: '📋 List Recent Submissions' }],
            [{ text: '🔍 Search by Winner ID' }]
        ],
        resize_keyboard: true
    };
};

// Format submission data
const formatSubmission = (submission) => {
    return `
🆔 ID: ${submission.id}
👤 Winner ID: ${submission.winner_id}
📝 Name: ${submission.full_name}
📧 Email: ${submission.email}
📱 Phone: ${submission.phone}
📍 Address: ${submission.address}
💳 Payment: ${submission.payment_preference}
🚚 Delivery: ${submission.delivery_company}
📢 Heard From: ${submission.heard_from}
⏰ Submitted: ${new Date(submission.submitted_at).toLocaleString()}

${DEV_WATERMARK}
`;
};

// Start command - show main menu
bot.onText(/\/start/, (msg) => {
    restrictToAdmin(msg, async () => {
        const chatId = msg.chat.id;
        const message = `
Welcome to the Submissions Admin Bot! 🤖

Use the keyboard buttons below to:
• List recent submissions
• Search submissions by winner ID

${DEV_WATERMARK}
`;
        bot.sendMessage(chatId, message, {
            reply_markup: getMainKeyboard()
        });
    });
});

// Handle keyboard button clicks and text messages
bot.on('message', (msg) => {
    restrictToAdmin(msg, async () => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // Handle main menu buttons
        switch (text) {
            case '📋 List Recent Submissions':
                try {
                    const { data: submissions, error } = await supabase
                        .from('submissions')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(999);

                    if (error) throw error;

                    if (!submissions || submissions.length === 0) {
                        bot.sendMessage(chatId, `No submissions found.\n\n${DEV_WATERMARK}`);
                        return;
                    }

                    for (const submission of submissions) {
                        const message = formatSubmission(submission);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    {
                                        text: '📄 View Documents',
                                        callback_data: `docs_${submission.id}`
                                    }
                                ]
                            ]
                        };
                        bot.sendMessage(chatId, message, { reply_markup: keyboard });
                    }
                } catch (error) {
                    bot.sendMessage(chatId, `Error fetching submissions: ${error.message}\n\n${DEV_WATERMARK}`);
                }
                break;

            case '🔍 Search by Winner ID':
                userStates.set(chatId, 'AWAITING_WINNER_ID');
                bot.sendMessage(chatId, `Please enter the Winner ID to search:\n\n${DEV_WATERMARK}`, {
                    reply_markup: {
                        keyboard: [
                            [{ text: '🔙 Back to Main Menu' }]
                        ],
                        resize_keyboard: true
                    }
                });
                break;

            case '🔙 Back to Main Menu':
                userStates.delete(chatId);
                bot.sendMessage(chatId, `Main Menu:\n\n${DEV_WATERMARK}`, {
                    reply_markup: getMainKeyboard()
                });
                break;

            default:
                // Handle winner ID search input
                if (userStates.get(chatId) === 'AWAITING_WINNER_ID') {
                    const winnerId = text;
                    userStates.delete(chatId);

                    try {
                        const { data: submissions, error } = await supabase
                            .from('submissions')
                            .select('*')
                            .eq('winner_id', winnerId)
                            .order('created_at', { ascending: false });

                        if (error) throw error;

                        if (!submissions || submissions.length === 0) {
                            bot.sendMessage(chatId, `No submissions found for winner ID: ${winnerId}\n\n${DEV_WATERMARK}`, {
                                reply_markup: getMainKeyboard()
                            });
                            return;
                        }

                        for (const submission of submissions) {
                            const message = formatSubmission(submission);
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        {
                                            text: '📄 View Documents',
                                            callback_data: `docs_${submission.id}`
                                        }
                                    ]
                                ]
                            };
                            bot.sendMessage(chatId, message, { reply_markup: keyboard });
                        }
                    } catch (error) {
                        bot.sendMessage(chatId, `Error searching submissions: ${error.message}\n\n${DEV_WATERMARK}`, {
                            reply_markup: getMainKeyboard()
                        });
                    }
                }
                break;
        }
    });
});

// Handle document viewing and downloading
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Access denied.' });
        return;
    }

    const action = callbackQuery.data;
    
    if (action.startsWith('docs_')) {
        const submissionId = action.split('_')[1];
        try {
            const { data: submission, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('id', submissionId)
                .single();

            if (error) throw error;

            if (!submission) {
                bot.answerCallbackQuery(callbackQuery.id, { text: 'Submission not found.' });
                return;
            }

            const message = `📄 *Documents for ${submission.full_name}*\nPlease click the buttons below to download the documents:\n\n${DEV_WATERMARK}`;

            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: '🆔 Download Front',
                            callback_data: `download_front_${submissionId}`
                        }
                    ],
                    [
                        {
                            text: '🆔 Download Back',
                            callback_data: `download_back_${submissionId}`
                        }
                    ]
                ]
            };

            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            bot.answerCallbackQuery(callbackQuery.id, {
                text: `Error fetching documents: ${error.message}`,
                show_alert: true
            });
        }
    } else if (action.startsWith('download_')) {
        const [type, side, submissionId] = action.split('_');
        try {
            const { data: submission, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('id', submissionId)
                .single();

            if (error) throw error;

            const url = side === 'front' ? submission.driver_license_front : submission.driver_license_back;
            if (!url) {
                bot.answerCallbackQuery(callbackQuery.id, {
                    text: 'Document URL not found.',
                    show_alert: true
                });
                return;
            }

            // Create a unique filename
            const fileExt = url.split('.').pop().split('?')[0];
            const fileName = `${submission.winner_id}_${side}_${Date.now()}.${fileExt}`;
            const localPath = path.join(tempDir, fileName);

            bot.sendMessage(chatId, `⏳ Downloading ${side} document...\n\n${DEV_WATERMARK}`);

            // Download the file
            await downloadFile(url, localPath);

            // Send the file
            await bot.sendDocument(chatId, localPath, {
                caption: `${side.toUpperCase()} document for ${submission.full_name}\n\n${DEV_WATERMARK}`
            });

            // Delete the file
            deleteFile(localPath);

            bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Document sent successfully!'
            });
        } catch (error) {
            bot.answerCallbackQuery(callbackQuery.id, {
                text: `Error downloading document: ${error.message}`,
                show_alert: true
            });
        }
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log(`${DEV_WATERMARK} Bot is running...`);