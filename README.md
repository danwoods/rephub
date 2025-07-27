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
5. Restrict the API key to Google Drive API and Google Sheets API for security
6. Copy your API key

### 3. Environment Configuration

#### For Local Development

Create a `.env.local` file in the project root:

```bash
GOOGLE_API_KEY=your_actual_api_key_here
```

#### For Vercel Deployment

1. Go to your project in the Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add a new environment variable:
   - **Name**: `GOOGLE_API_KEY`
   - **Value**: Your Google API key
   - **Environments**: Production, Preview, and Development

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
- Contains Google Sheets files
- First column (A) contains song titles
- Example:
  ```
  setlists/
  ├── Summer Concert (Google Sheet)
  └── Winter Show (Google Sheet)
  ```

### 5. Update Folder IDs

Edit `src/config.js` and replace the folder IDs with your own:

```javascript
export const CONFIG = {
  songsFolderId: 'YOUR_SONGS_FOLDER_ID',     // Replace with your songs folder ID
  setlistsFolderId: 'YOUR_SETLISTS_FOLDER_ID', // Replace with your setlists folder ID
  cacheKey: 'rephub_cache',
  cacheExpiry: 24 * 60 * 60 * 1000 // 24 hours
};
```

To get folder IDs:
1. Open Google Drive in your browser
2. Navigate to the folder you want to use
3. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 6. Song File Format

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

### 7. Run the Application

#### Local Development
```bash
npm start
```

The app will open at `http://localhost:3000`

#### Deploy to Vercel

1. Connect your repository to Vercel
2. Ensure the `GOOGLE_API_KEY` environment variable is set (see step 3)
3. Deploy

### 8. Troubleshooting

#### Check Environment Configuration

After deployment, you can test if your environment is configured correctly by visiting:
`https://your-app.vercel.app/api/test-env`

This endpoint will tell you if the Google API key is properly configured.

#### Common Issues

- **No spreadsheets showing**: Usually means `GOOGLE_API_KEY` is not set in Vercel environment variables
- **No songs showing**: Check that the songs folder ID in `src/config.js` is correct
- **API errors**: Verify that both Google Drive API and Google Sheets API are enabled in Google Cloud Console

#### Debug Information

The app includes extensive console logging. Open browser DevTools → Console to see detailed information about API requests and responses.

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
