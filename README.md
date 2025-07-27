# RepHub - Music Repertoire & Setlists

A modern React web application for managing music repertoire and setlists with Google Drive integration.

## Features

✅ **Google Drive API Integration**: Fetches real data from your folders  
✅ **React Router**: Clean navigation between songs and setlists  
✅ **Markdown Rendering**: Full markdown-it-chords integration  
✅ **Performance Mode**: iPad-optimized full-screen view  
✅ **Tailwind CSS**: Modern, responsive design  
✅ **Caching**: Local storage for offline functionality  
✅ **Error Handling**: Graceful fallbacks when API fails  
✅ **Keyboard Navigation**: Arrow keys, spacebar, escape in performance mode  

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API and Google Sheets API
4. Create credentials (API Key)
5. Copy your API key

### 3. Update Configuration

Edit `src/config.js` and replace the API key:

```javascript
export const CONFIG = {
  songsFolderId: '1w-jfbKc8pK4qCnak29xdb2cj6SpyxF9m',
  setlistsFolderId: '1jlKGeefkosdsrBwJ2toN0IB8a-G1FhGP',
  apiKey: 'YOUR_API_KEY_HERE', // Replace with your actual API key
  cacheKey: 'rephub_cache',
  cacheExpiry: 24 * 60 * 60 * 1000 // 24 hours
};
```

### 4. Google Drive Folder Structure

**Songs Folder:**
- Each subfolder represents a song
- Each subfolder contains a `README.md` file
- `README.md` must have TOML frontmatter with `title`, `key`, and `tempo`
- Example:
  ```
  songs/
  ├── amazing_grace/
  │   └── README.md
  └── greensleeves/
      └── README.md
  ```

**Setlists Folder:**
- Contains spreadsheet files (.xlsx)
- First column (A) contains song titles
- Example:
  ```
  setlists/
  ├── Summer Concert.xlsx
  └── Winter Show.xlsx
  ```

### 5. Song File Format

Each `README.md` should follow this format:

```markdown
---
title = "Amazing Grace"
key = "G"
tempo = "120"
---

[G]Amazing grace, how [D]sweet the [G]sound\\
That saved a wretch like [D]me\\
I once was lost, but [G]now I'm [D]found\\
Was blind, but [G]now I [D]see\\
```

### 6. Run the Application

```bash
npm start
```

The app will open at `http://localhost:3000`

## Usage

### Browsing Songs
- Navigate to the Songs section
- Click on any song to view its content
- Chords are rendered above lyrics using markdown-it-chords

### Browsing Setlists
- Navigate to the Setlists section
- Click on any setlist to view its songs
- Songs are matched by title (case-insensitive)

### Performance Mode
- From any setlist view, click "Performance Mode"
- Full-screen, distraction-free view optimized for iPad
- Navigate with arrow keys, spacebar, or on-screen buttons
- Press Escape to exit

### Keyboard Shortcuts (Performance Mode)
- **Arrow Right** or **Spacebar**: Next song
- **Arrow Left**: Previous song
- **Escape**: Exit performance mode

## Technology Stack

- **React 18**: Modern React with hooks
- **React Router 6**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **markdown-it**: Markdown parser
- **markdown-it-chords**: Chord rendering plugin
- **TOML**: Frontmatter parsing
- **Google Drive API**: Data fetching
- **Google Sheets API**: Spreadsheet reading

## Development

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Sidebar.js      # Navigation sidebar
│   ├── SongList.js     # Songs list view
│   ├── SongView.js     # Individual song view
│   ├── SetlistList.js  # Setlists list view
│   ├── SetlistView.js  # Individual setlist view
│   └── PerformanceMode.js # Full-screen performance view
├── hooks/              # Custom React hooks
│   └── useGoogleDrive.js # Google Drive integration
├── utils/              # Utility functions
│   └── markdown.js     # Markdown parsing utilities
├── config.js           # Configuration settings
├── App.js              # Main app component
└── index.js            # App entry point
```

## Features Implemented

✅ **Google Drive API Integration**: Fetches real data from your folders  
✅ **Routing**: Clean navigation between songs and setlists  
✅ **Markdown Rendering**: Full markdown-it-chords integration  
✅ **Performance Mode**: iPad-optimized full-screen view  
✅ **Caching**: Local storage for offline functionality  
✅ **Error Handling**: Graceful fallbacks when API fails  
✅ **Responsive Design**: Works on desktop, tablet, and mobile  
✅ **Keyboard Navigation**: Full keyboard support in performance mode  
✅ **Modern UI**: Clean, professional design with Tailwind CSS  
