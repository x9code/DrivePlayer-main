# 🎵 DrivePlayer

A modern, feature-rich music player that streams audio files directly from Google Drive. Built with React and Node.js, DrivePlayer offers a premium listening experience with real-time audio visualization, favorites management, and an intuitive Spotify-inspired interface.

## ✨ Features

### 🎨 Beautiful UI
- **Spotify-Inspired Design**: Clean, modern table layout with sticky headers
- **Dynamic Background**: Album art-based glow effect that adapts to each song
- **Real-Time Visualizer**: Audio frequency bars that react to the beat, color-matched to album art
- **Responsive Layout**: Seamless experience across desktop and mobile devices

### 🎧 Player Features
- **Mini & Full Screen Modes**: Compact player bar or immersive full-screen view
- **Favorites System**: Heart your favorite tracks and access them from any folder
- **Playback Controls**: Shuffle, repeat (off/all/one), previous, next
- **Progress Seeking**: Click or drag to jump to any point in the track
- **Volume Control**: Adjustable volume with mute toggle

### ⌨️ Keyboard Shortcuts
- **Space**: Play/Pause
- **F**: Toggle Full Screen
- **N / P**: Next / Previous Track
- **M**: Mute/Unmute
- **Left/Right**: Seek ±5 seconds
- **Ctrl + Left/Right**: Previous/Next Track
- **Up/Down**: Volume Control

### 📁 File Management
- **Folder Navigation**: Browse through your Google Drive folder structure
- **Search**: Quickly find songs across all folders
- **Sorting**: Sort by name, date, or file size (ascending/descending)
- **Smart Title Cleaning**: Automatically removes numbering and artist prefixes

### 🎵 Audio Visualizer
- **Dynamic Colors**: Extracts dominant color from album art
- **High Resolution**: 512-bar FFT for smooth, detailed visualization
- **Bottom-Aligned**: Fills the screen width as a dynamic footer
- **Performance Optimized**: Hardware-accelerated rendering

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Google Drive API credentials
- A Google account with audio files in Drive

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DrivePlayer.git
   cd DrivePlayer
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install

   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up Google Drive API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Drive API
   - Create OAuth 2.0 credentials
   - Download the credentials and save as `credentials.json` in the root directory

4. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   FOLDER_ID=your_google_drive_folder_id
   ```

   Create a `.env` file in the `client` directory:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

5. **Run the application**
   ```bash
   # Development mode (runs both server and client)
   npm run dev

   # Or run separately:
   # Terminal 1 - Server
   npm run server

   # Terminal 2 - Client
   cd client
   npm run dev
   ```

6. **First-time authentication**
   - On first run, the server will prompt you to authenticate with Google
   - Follow the URL in the console to authorize the application
   - The token will be saved for future use

## 📖 Usage

### Playing Music
1. Navigate through folders by clicking on folder names
2. Click on any song to start playback
3. Use the mini player at the bottom or click to expand to full screen
4. Click the heart icon to add songs to your favorites

### Favorites
- Click the heart icon next to any song title to add it to favorites
- Access your favorites by clicking the **Favorites** button in the header
- Favorites are saved locally in your browser

### Visualizer
- The audio visualizer appears at the bottom of the full-screen player
- Colors automatically match the current album art
- Bars react in real-time to the music's frequency spectrum

## 🛠️ Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Icons** - Icon library
- **Axios** - HTTP client

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **Google APIs** - Drive integration
- **Music Metadata** - Audio file metadata extraction

### Audio
- **Web Audio API** - Real-time audio analysis and visualization
- **Canvas API** - Visualizer rendering

## 📁 Project Structure

```
DrivePlayer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Player.jsx
│   │   │   └── SongList.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   └── public/
├── server.js              # Express backend
├── credentials.json       # Google API credentials (not in repo)
├── token.json            # OAuth token (generated on first run)
└── README.md
```

## 🎨 Features in Detail

### Audio Visualizer
The visualizer uses the Web Audio API to analyze audio in real-time:
- **FFT Size**: 1024 (512 frequency bins)
- **Color Extraction**: Samples album art to determine dominant RGB values
- **Rendering**: Canvas-based with gradient effects and opacity blending
- **Performance**: GPU-accelerated transforms for smooth 60fps animation

### Favorites System
- Stored in browser's `localStorage`
- Persists across sessions
- Works across different Drive folders
- Displays as a virtual "Favorites" folder

### Smart Title Cleaning
Automatically cleans song titles by:
- Removing file extensions
- Stripping leading numbers (e.g., "01 - ")
- Detecting and removing artist prefixes
- Handling "feat." and remix suffixes intelligently

## 🔧 Configuration

### Changing the Root Folder
Update the `FOLDER_ID` in your `.env` file to point to a different Google Drive folder.

### Customizing the Visualizer
Edit `Player.jsx` to adjust:
- `fftSize` - Higher values = more bars (512, 1024, 2048)
- `usefulBars` - Percentage of frequency range to display
- Colors, opacity, and gradient settings

## 🐛 Troubleshooting

### Audio won't play
- Check that the server has proper CORS headers enabled
- Verify the audio element has `crossOrigin="anonymous"`
- Ensure your Google Drive files are accessible

### Visualizer not working
- Check browser console for Web Audio API errors
- Verify CORS is properly configured
- Try refreshing the page after playback starts

### Favorites not saving
- Check that localStorage is enabled in your browser
- Verify you're not in private/incognito mode

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Inspired by Spotify's desktop interface
- Built with modern web technologies
- Uses Google Drive API for cloud storage

---

**Enjoy your music! 🎶**
