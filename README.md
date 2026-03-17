# DrivePlayer

A modern, high-fidelity music player that streams your audio collection directly from **Google Drive**. 

Built with **React (Vite)** and **Node.js**, DrivePlayer offers a premium listening experience with **Lossless & Hi-Res Audio support**, real-time visualization, synced lyrics, and a stunning **Glassmorphism** interface inspired by Apple Music.

## ✨ Key Features

### 🎧 High-Fidelity Audio
- **Lossless & Hi-Res**: Native playback of FLAC and high-resolution audio (up to 24-bit/192kHz).
- **Smart Badges**: Dynamic **"Lossless"** and **"Hi-Res Lossless"** badges based on technical metadata.
- **Direct Streaming**: Streams directly from Google CDN for maximum performance and low latency.

### 🎨 Premium UI/UX
- **Glassmorphism Design**: Translucent interface with blur effects and dynamic gradients.
- **Dynamic Theming**: The app adapts its color scheme to the current track's album art.
- **Customizable Themes**: Choose your preferred app color (defaults to elegant Dark Lavender).
- **Responsive Layout**: Fully optimized for mobile with a dedicated bottom navigation and gesture-friendly UI.

### 🔐 Advanced Security & Auth
- **Username-Based Auth**: Secure registration and login without requiring emails.
- **Telegram OTP**: Two-factor verification integrated via a private Telegram Bot.
- **Account Management**: Update your username, upload a custom avatar, or permanently delete your account.

### 📁 Smart Library Management
- **PostgreSQL Backend**: Persistent storage for favorites, playlists, and playback statistics.
- **Greedy Artwork Discovery**: Automatically fetches covers from ID3 tags, Google Drive, or iTunes.
- **Custom Folder Covers**: Upload and protect your own folder artwork.
- **Recursive Sync**: Fast, efficient background synchronization of your entire Drive library.
- **Batch Downloads**: Download entire folders or albums as a simplified ZIP file.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher.
- **PostgreSQL**: A running instance for data persistence.
- **Google Cloud**: A project with **Google Drive API** enabled and a Service Account.
- **Telegram Bot** (Optional): For OTP verification features.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DrivePlayer.git
   cd DrivePlayer
   ```

2. **Server Setup**
   ```bash
   cd server
   npm install
   ```
   Create a `.env` file in `server/`:
   ```env
   PORT=5000
   DATABASE_URL=postgres://user:password@localhost:5432/driveplayer
   JWT_SECRET=your_secret_key
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

3. **Client Setup**
   ```bash
   cd ../client
   npm install
   ```
   Create a `.env` file in `client/`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

4. **Run the Application**
   ```bash
   # From the root directory
   npm run dev
   ```

---

## 🛠️ Tech Stack

### Frontend
- **React 18 & Vite**: Component-based UI with fast HMR.
- **TailwindCSS**: Premium utility-first styling.
- **Framer Motion**: Smooth, high-performance animations.
- **React Icons**: Modern iconography (Io5, Fa, Md).

### Backend
- **Node.js & Express**: Extensible API server.
- **PostgreSQL**: Reliable relational database via `pg` pool.
- **Music-Metadata**: Deep analysis of audio bit-depth, sample rates, and codecs.
- **node-telegram-bot-api**: Integration for secure OTP delivery.
- **Archiver**: Server-side ZIP generation for folder downloads.

---

## 📝 Usage Tips
- **Shortcuts**: `Space` (Play/Pause), `F` (Full Screen), `N/P` (Next/Prev).
- **Rescan**: Hit the "Rescan Library" button in settings if you've added new music to Drive.
- **Quality**: Check the "i" icon on the player to see technical details for Lossless tracks.

---

## 📄 License
MIT License. Copyright © 2026 [**Deepak Kumar Rana**](https://github.com/x9code/DrivePlayer-main).
