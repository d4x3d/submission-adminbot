# Supabase Submissions Telegram Bot 👩‍💻《D4X3D》

A Telegram bot for managing submissions from a Supabase database. The bot allows administrators to view and download submission documents securely.

## Features

- 📋 List recent submissions
- 🔍 Search submissions by winner ID
- 📄 View and download submission documents
- 🔒 Admin-only access
- 🗑️ Automatic cleanup of downloaded files

## Setup

1. Clone the repository
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_CHAT_ID=your_admin_chat_id
```

4. Start the bot
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Bot Commands

The bot uses keyboard buttons instead of commands for better user experience:
- 📋 List Recent Submissions - Shows the latest 10 submissions
- 🔍 Search by Winner ID - Search for specific submissions

## Database Structure

The bot works with a Supabase database containing the following fields:
- id (UUID)
- winner_id (text)
- full_name (text)
- email (text)
- phone (text)
- address (text)
- payment_preference (text)
- delivery_company (text)
- heard_from (text)
- driver_license_front (text - URL)
- driver_license_back (text - URL)
- submitted_at (timestamp)

## Security Features

- Admin-only access through chat ID verification
- Secure document handling with temporary storage
- Automatic file cleanup after sending
- Environment variable configuration

## Developer

👩‍💻《D4X3D》

## License

This project is private and proprietary. All rights reserved.