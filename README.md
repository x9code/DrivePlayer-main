# 🎵 DrivePlayer

A modern, high-fidelity music player that streams your audio collection directly from **Google Drive**. 

Built with **React** and **Node.js**, DrivePlayer offers a premium listening experience with **Lossless & Hi-Res Audio support**, real-time visualization, synced lyrics, and a stunning **Glassmorphism** interface inspired by Apple Music.

## ✨ Key Features

### 🎧 High-Fidelity Audio
- **Lossless Support**: Native playback of FLAC files with full metadata.
- **Hi-Res Audio**: Automatically detects and plays high-resolution audio (up to 24-bit/192kHz).
- **Smart Badges**: Dynamic **"Lossless"** and **"Hi-Res Lossless"** badges based on file quality.
- **Technical Details**: Interactive modal revealing **Bit Depth**, **Sample Rate**, and **Codec** information.

### 🎨 Premium UI/UX
- **Glassmorphism Design**: Beautiful, translucent interface with blur effects and dynamic gradients.
- **Dynamic Theming**: The entire app adapts its color scheme to the currently playing album art.
- **Real-Time Visualizer**: 512-bar FFT audio visualizer that reacts to the beat, color-matched to the track.
- **Responsive Layout**: Seamless experience across desktop and mobile devices.

### 🎤 Lyrics & Immersion
- **Synced Lyrics**: Supports standard LRC files for time-synced lyrics.
- **Plain Text Lyrics**: Fallback to text lyrics if no sync data is available.
- **Immersive Mode**: Full-screen player with large artwork and synchronized visual elements.

### 🛡️ Privacy & Security
- **Auto-Lock**: Automatically locks the interface after inactivity to secure your session.
- **Secure Auth**: OAuth 2.0 integration with Google Drive for secure access.

### 📊 Integrated Analytics
- **Vercel Analytics**: Built-in privacy-friendly analytics to track app usage and performance.

### 📁 Advanced Library Management
- **Folder Navigation**: Browse your entire Google Drive folder structure.
- **Global Search**: Instantly find songs across all folders.
- **Smart Sorting**: Sort by Name, Date, or Size.
- **Favorites**: "Like" tracks to build a cross-folder collection of favorites.
- **Smart Title Cleaning**: Automatically cleans up file names (removes extensions, numbers, "remix" suffixes, etc.) for a clean library view.

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
- **React 18** - UI Library
- **Vite** - Next-gen build tool
- **TailwindCSS** - Styling & Design System
- **Framer Motion** - Animations (implied usage for smooth transitions)
- **React Icons** - Iconography
- **Vercel Analytics** - Performance monitoring

### Backend
- **Node.js & Express** - Server side logic
- **GoogleAPIs** - Drive integration
- **Music-Metadata** - Advanced audio metadata parsing (Bitrate, Sample Rate, etc.)

---

## 📝 Usage Tips

- **Keyboard Shortcuts**:
    - `Space`: Play/Pause
    - `F`: Toggle Full Screen
    - `N / P`: Next / Previous Track
    - `Ctrl + L`: Lock App immediately
- **Visualizer Customization**: The visualizer sensitivity and style are tuned for a balance between responsiveness and aesthetics.
- **Favorites**: Your favorites are stored locally in the browser, meaning they persist even if you close the tab.

---

## 📄 License
This project is open-source and available under the **MIT License**.

---

**Enjoy your music in high fidelity! 🎶**
