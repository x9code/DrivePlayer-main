# DrivePlayer

A modern, high-fidelity music player that streams your audio collection directly from **Google Drive**. 

Built with **React** and **Node.js**, DrivePlayer offers a premium listening experience with **Lossless & Hi-Res Audio support**, real-time visualization, synced lyrics, and a stunning **Glassmorphism** interface inspired by Apple Music.

## ✨ Key Features

### 🎧 High-Fidelity Audio
- **Lossless Support**: Native playback of FLAC files with full metadata extraction.
- **Hi-Res Audio**: Automatically detects and plays high-resolution audio (up to 24-bit/192kHz).
- **Smart Badges**: Dynamic **"Lossless"** and **"Hi-Res Lossless"** badges based on file quality.
- **Technical Details**: Interactive modal revealing **Bit Depth**, **Sample Rate**, and **Codec**.

### 🎨 Premium UI/UX
- **Glassmorphism Design**: Beautiful, translucent interface with blur effects and dynamic gradients.
- **Dynamic Theming**: The entire app adapts its color scheme to the currently playing album art.
- **Real-Time Visualizer**: 512-bar FFT audio visualizer that reacts to the beat, color-matched to the track.
- **Responsive Layout**: Seamless experience across desktop and mobile devices with adaptive sidebars.

### 🎤 Lyrics & Immersion
- **Synced Lyrics**: Supports standard LRC files and advanced `am-lyrics` web components for time-synced playback.
- **Plain Text Lyrics**: Fallback to text lyrics if no sync data is available.
- **Immersive Mode**: Full-screen player with large artwork and synchronized visual elements.

### 📁 Advanced Library Management
- **Greedy Folder Artwork**: Automatically discovers folder covers by checking embedded art, Drive thumbnails, and subfolders.
- **iTunes Discovery**: Integrated **iTunes Search API** to fetch high-quality artwork for tracks with missing local tags.
- **Manual Cover Protection**: Upload custom folder covers that are strictly protected from automatic updates.
- **Global Search**: Instantly find songs, albums, or artists across your entire collection.
- **Favorites & Playlists**: Persistent user collections stored securely in a PostgreSQL backend.
- **Smart Title Cleaning**: Automatically sanitizes filenames for a professional, clean library view.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Google Cloud Project with **Google Drive API** enabled
- A Google account with audio files in Drive

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DrivePlayer.git
   cd DrivePlayer
   ```

2. **Install Server Dependencies**
   ```bash
   npm install
   ```

3. **Install Client Dependencies**
   ```bash
   cd client
   npm install
   ```
   > **Note:** The client requires `@vercel/analytics`. If it fails to install automatically, run `npm i @vercel/analytics` inside the `client` folder manually.

4. **Set up Google Drive API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project and enable the **Google Drive API**.
   - Create **OAuth 2.0 credentials** (Desktop App).
   - Download the JSON file and save it as `credentials.json` in the **root** directory.

5. **Configure Environment Variables**

   Create a `.env` file in the **root** directory:
   ```env
   PORT=5000
   FOLDER_ID=your_google_drive_folder_id
   # Optional: Set a specific port or secret
   ```

   Create a `.env` file in the `client` directory:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

6. **Run the Application**
   ```bash
   # Development mode (runs both server and client concurrently)
   npm run dev
   ```

   Or run them separately:
   - **Server**: `npm run server` (Root)
   - **Client**: `npm run dev` (In `client/`)

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - Component-based UI Architecture
- **Vite** - High-performance build tooling
- **TailwindCSS** - Premium Styling & Glassmorphism Design
- **Framer Motion** - Fluid animations and state transitions
- **React Icons** - Modern iconography (Io, Fa, Md)

### Backend
- **Node.js & Express** - Scalable server-side logic
- **PostgreSQL** - High-performance relational database for user data and metadata
- **GoogleAPIs** - Seamless Google Drive & OAuth 2.0 integration
- **Music-Metadata** - Deep audio analysis (Lossless/Hi-Res detection, Bitrate, Codec)
- **iTunes Search API** - Robust external artwork resolution pipeline

---

## 📝 Usage Tips

- **Keyboard Shortcuts**:
    - `Space`: Play/Pause
    - `F`: Toggle Full Screen
    - `N / P`: Next / Previous Track
    - `Ctrl + L`: Lock App session immediately
- **Folder Art**: To set a custom cover, use the 3-dot menu on any folder and upload a PNG. These covers take priority and are never overwritten.
- **Deep Sync**: If you notice missing metadata, use the **Rescan Library** button in settings to trigger a full background enrichment pass.
- **Persistence**: Your favorites, playlists, and folder covers are stored securely in the database and synched across your devices.

---

## 📄 License
This project is licensed under the **MIT License**.
Copyright © 2026 [**Deepak Kumar Rana**](https://github.com/x9code/DrivePlayer-main/tree/main).

---

**Enjoy your music in high fidelity! 🎶**
