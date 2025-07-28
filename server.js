const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const { parseFrontmatter } = require('./api/utils/frontmatter');

const app = express();
const PORT = 3000; // Back to original port

// Server-side cache
const cache = {
  songs: null,
  setlists: null,
  lastFetch: null,
  lastSuccessfulFetch: null,
  isRefreshing: false
};

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const BACKGROUND_REFRESH_THRESHOLD = 15 * 60 * 1000; // Start background refresh after 15 minutes

// Cache helper functions
const isCacheValid = () => {
  return cache.lastSuccessfulFetch && (Date.now() - cache.lastSuccessfulFetch < CACHE_TTL);
};

const shouldBackgroundRefresh = () => {
  return cache.lastSuccessfulFetch && 
         (Date.now() - cache.lastSuccessfulFetch > BACKGROUND_REFRESH_THRESHOLD) &&
         !cache.isRefreshing;
};

const fetchSongsFromDrive = async () => {
  console.log('Fetching songs from Google Drive...');
  const CONFIG = {
    songsFolderId: '1w-jfbKc8pK4qCnak29xdb2cj6SpyxF9m'
  };
  
  try {
    // Get list of all folders in the songs folder
    const foldersResponse = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await drive.files.list({
          q: `'${CONFIG.songsFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
          fields: 'files(id,name)',
          pageSize: 100
        });
      });
    });

    const folders = foldersResponse.data.files || [];
    const songs = {};

    for (const folder of folders) {
      try {
        // Find README.md in this folder
        const readmeResponse = await rateLimitedRequest(async () => {
          return await retryWithBackoff(async () => {
            return await drive.files.list({
              q: `'${folder.id}' in parents and name='README.md'`,
              fields: 'files(id,name)'
            });
          });
        });

        if (readmeResponse.data.files && readmeResponse.data.files.length > 0) {
          const readmeId = readmeResponse.data.files[0].id;
          
          // Fetch the README.md content
          const contentResponse = await rateLimitedRequest(async () => {
            return await retryWithBackoff(async () => {
              return await drive.files.get({
                fileId: readmeId,
                alt: 'media'
              });
            });
          });

          // Parse frontmatter from the content
          const { frontmatter, content } = parseFrontmatter(contentResponse.data);
          
          songs[folder.name] = {
            title: frontmatter.title || folder.name,
            content: contentResponse.data,
            // Include parsed metadata
            ...frontmatter
          };
        }
      } catch (folderError) {
        console.error(`Error processing folder ${folder.name}:`, folderError);
      }
    }

    return songs;
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
};

const fetchSetlistsFromDrive = async () => {
  console.log('Fetching setlists from Google Drive...');
  const CONFIG = {
    setlistsFolderId: '1jlKGeefkosdsrBwJ2toN0IB8a-G1FhGP'
  };
  
  try {
    // Get list of all Google Sheets files in the setlists folder
    const filesResponse = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await drive.files.list({
          q: `'${CONFIG.setlistsFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
          fields: 'files(id,name,mimeType)',
          pageSize: 100
        });
      });
    });

    const files = filesResponse.data.files || [];
    const setlists = {};

    for (const file of files) {
      try {
        // First, get metadata to discover all sheets in this spreadsheet
        const metadataResponse = await rateLimitedRequest(async () => {
          return await retryWithBackoff(async () => {
            return await sheets.spreadsheets.get({
              spreadsheetId: file.id,
              fields: 'properties,sheets.properties'
            });
          });
        });

        const spreadsheetMetadata = metadataResponse.data;
        const sheetsList = spreadsheetMetadata.sheets || [];
        
        // Process each sheet in the spreadsheet
        for (const sheet of sheetsList) {
          const sheetName = sheet.properties.title;
          
          try {
            const valuesResponse = await rateLimitedRequest(async () => {
              return await retryWithBackoff(async () => {
                return await sheets.spreadsheets.values.get({
                  spreadsheetId: file.id,
                  range: `${sheetName}!A:Z`
                });
              });
            });

            const rows = valuesResponse.data.values || [];
            if (rows.length > 0) {
              // Create a meaningful setlist name
              // If there's only one sheet, use just the file name
              // If multiple sheets, use "FileName - SheetName" format
              const setlistName = sheetsList.length === 1 ? 
                file.name : 
                `${file.name} - ${sheetName}`;
              
              setlists[setlistName] = {
                name: setlistName,
                songs: rows.flat().filter(cell => cell && cell.trim())
              };
            }
          } catch (sheetError) {
            console.error(`Error processing sheet "${sheetName}" in file "${file.name}":`, sheetError);
            continue; // Try next sheet
          }
        }
      } catch (fileError) {
        console.error(`Error processing setlist file ${file.name}:`, fileError);
      }
    }

    return setlists;
  } catch (error) {
    console.error('Error fetching setlists:', error);
    throw error;
  }
};

const refreshCacheData = async () => {
  if (cache.isRefreshing) {
    return; // Already refreshing
  }

  cache.isRefreshing = true;
  cache.lastFetch = Date.now();

  try {
    console.log('Refreshing cache data...');
    const [songs, setlists] = await Promise.all([
      fetchSongsFromDrive(),
      fetchSetlistsFromDrive()
    ]);

    cache.songs = songs;
    cache.setlists = setlists;
    cache.lastSuccessfulFetch = Date.now();
    
    console.log(`Cache refreshed - Songs: ${Object.keys(songs).length}, Setlists: ${Object.keys(setlists).length}`);
  } catch (error) {
    console.error('Error refreshing cache:', error);
    // Keep existing cache data on error
  } finally {
    cache.isRefreshing = false;
  }
};

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// New cached data endpoints
app.get('/api/data/songs', async (req, res) => {
  try {
    // If we have valid cache, serve it immediately
    if (isCacheValid() && cache.songs) {
      console.log('Serving cached songs');
      
      // Start background refresh if needed
      if (shouldBackgroundRefresh()) {
        console.log('Starting background refresh for songs');
        refreshCacheData().catch(err => console.error('Background refresh failed:', err));
      }
      
      return res.json({
        songs: cache.songs,
        cached: true,
        lastFetch: cache.lastSuccessfulFetch
      });
    }

    // No valid cache, fetch fresh data
    console.log('No valid cache, fetching fresh songs data');
    await refreshCacheData();
    
    res.json({
      songs: cache.songs || {},
      cached: false,
      lastFetch: cache.lastSuccessfulFetch
    });
  } catch (error) {
    console.error('Error in /api/data/songs:', error);
    
    // If we have any cached data (even expired), serve it with error flag
    if (cache.songs) {
      return res.json({
        songs: cache.songs,
        cached: true,
        error: error.message,
        lastFetch: cache.lastSuccessfulFetch
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/setlists', async (req, res) => {
  try {
    // If we have valid cache, serve it immediately
    if (isCacheValid() && cache.setlists) {
      console.log('Serving cached setlists');
      
      // Start background refresh if needed
      if (shouldBackgroundRefresh()) {
        console.log('Starting background refresh for setlists');
        refreshCacheData().catch(err => console.error('Background refresh failed:', err));
      }
      
      return res.json({
        setlists: cache.setlists,
        cached: true,
        lastFetch: cache.lastSuccessfulFetch
      });
    }

    // No valid cache, fetch fresh data
    console.log('No valid cache, fetching fresh setlists data');
    await refreshCacheData();
    
    res.json({
      setlists: cache.setlists || {},
      cached: false,
      lastFetch: cache.lastSuccessfulFetch
    });
  } catch (error) {
    console.error('Error in /api/data/setlists:', error);
    
    // If we have any cached data (even expired), serve it with error flag
    if (cache.setlists) {
      return res.json({
        setlists: cache.setlists,
        cached: true,
        error: error.message,
        lastFetch: cache.lastSuccessfulFetch
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/all', async (req, res) => {
  try {
    // If we have valid cache, serve it immediately
    if (isCacheValid() && cache.songs && cache.setlists) {
      console.log('Serving all cached data');
      
      // Start background refresh if needed
      if (shouldBackgroundRefresh()) {
        console.log('Starting background refresh for all data');
        refreshCacheData().catch(err => console.error('Background refresh failed:', err));
      }
      
      return res.json({
        songs: cache.songs,
        setlists: cache.setlists,
        cached: true,
        lastFetch: cache.lastSuccessfulFetch
      });
    }

    // No valid cache, fetch fresh data
    console.log('No valid cache, fetching fresh data');
    await refreshCacheData();
    
    res.json({
      songs: cache.songs || {},
      setlists: cache.setlists || {},
      cached: false,
      lastFetch: cache.lastSuccessfulFetch
    });
  } catch (error) {
    console.error('Error in /api/data/all:', error);
    
    // If we have any cached data (even expired), serve it with error flag
    if (cache.songs || cache.setlists) {
      return res.json({
        songs: cache.songs || {},
        setlists: cache.setlists || {},
        cached: true,
        error: error.message,
        lastFetch: cache.lastSuccessfulFetch
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/data/refresh', async (req, res) => {
  try {
    console.log('Manual refresh requested');
    await refreshCacheData();
    
    res.json({
      songs: cache.songs || {},
      setlists: cache.setlists || {},
      lastFetch: cache.lastSuccessfulFetch,
      refreshed: true
    });
  } catch (error) {
    console.error('Error in manual refresh:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize Google Drive API
const drive = google.drive({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY || 'AIzaSyCscwbCLqEVhvW8Ia3ZQ54biXtqdfqFQhE'
});

// Initialize Google Sheets API
const sheets = google.sheets({
  version: 'v4',
  auth: process.env.GOOGLE_API_KEY || 'AIzaSyCscwbCLqEVhvW8Ia3ZQ54biXtqdfqFQhE'
});

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting - track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests (faster now that VPN resolved blocking)

// Helper function to ensure minimum time between requests
const rateLimitedRequest = async (requestFn) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${waitTime}ms`);
    await delay(waitTime);
  }
  
  lastRequestTime = Date.now();
  return requestFn();
};

// Retry logic with exponential backoff
const retryWithBackoff = async (requestFn, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await requestFn();
      
      // Check if the response contains HTML error page from Google
      if (result && result.data && typeof result.data === 'string' && result.data.includes('automated queries')) {
        throw new Error('Google detected automated queries');
      }
      
      return result;
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      // Check if it's a rate limiting error or automated query detection
      if (error.message.includes('automated queries') || error.message.includes('rate limit') || 
          (error.response && error.response.data && typeof error.response.data === 'string' && error.response.data.includes('automated queries'))) {
        console.log('Rate limiting or automated query detection, waiting longer...');
        const backoffTime = Math.pow(2, attempt) * 10000; // Much longer backoff for rate limiting
        console.log(`Retrying in ${backoffTime}ms...`);
        await delay(backoffTime);
      } else if (attempt === maxRetries) {
        throw error;
      } else {
        // Exponential backoff: 2^attempt seconds
        const backoffTime = Math.pow(2, attempt) * 2000;
        console.log(`Retrying in ${backoffTime}ms...`);
        await delay(backoffTime);
      }
    }
  }
};

// API routes for Google Drive
app.get('/api/drive/files', async (req, res) => {
  try {
    const { q, fields } = req.query;
    console.log('Drive API request:', { q, fields });
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const response = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await drive.files.list({
          q: q,
          fields: fields,
          pageSize: 100
        });
      });
    });
    
    console.log('Drive API response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Drive API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/drive/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { alt } = req.query;
    
    if (alt === 'media') {
      // Download file content
      const response = await rateLimitedRequest(async () => {
        return await retryWithBackoff(async () => {
          return await drive.files.get({
            fileId: fileId,
            alt: 'media'
          });
        });
      });
      
      res.set('Content-Type', 'text/plain');
      res.send(response.data);
    } else {
      // Get file metadata
      const response = await rateLimitedRequest(async () => {
        return await retryWithBackoff(async () => {
          return await drive.files.get({
            fileId: fileId,
            fields: 'id,name,mimeType'
          });
        });
      });
      
      res.json(response.data);
    }
  } catch (error) {
    console.error('Drive file API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API routes for Google Sheets
app.get('/api/sheets/spreadsheets/:spreadsheetId/values/:range', async (req, res) => {
  try {
    const { spreadsheetId, range } = req.params;
    console.log('Sheets API request:', { spreadsheetId, range });
    
    const response = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: range
        });
      });
    });
    
    console.log('Sheets API response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Sheets API error:', error.message);
    console.error('Sheets API error details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch API endpoint to fetch multiple songs at once
app.get('/api/drive/batch-songs', async (req, res) => {
  try {
    const { folderIds } = req.query;
    if (!folderIds) {
      return res.status(400).json({ error: 'folderIds parameter is required' });
    }
    
    const folderIdArray = folderIds.split(',');
    const songs = {};
    
    console.log(`Batch fetching songs for ${folderIdArray.length} folders`);
    
    for (const folderId of folderIdArray) {
      try {
        // Get folder name first
        const folderResponse = await rateLimitedRequest(async () => {
          return await retryWithBackoff(async () => {
            return await drive.files.get({
              fileId: folderId,
              fields: 'name'
            });
          });
        });
        
        const folderName = folderResponse.data.name;
        console.log(`Processing folder: ${folderName} (ID: ${folderId})`);
        
        // Find README.md in this folder
        const readmeResponse = await rateLimitedRequest(async () => {
          return await retryWithBackoff(async () => {
            return await drive.files.list({
              q: `'${folderId}' in parents and name='README.md'`,
              fields: 'files(id,name)'
            });
          });
        });
        
        if (readmeResponse.data.files && readmeResponse.data.files.length > 0) {
          const readmeId = readmeResponse.data.files[0].id;
          
          // Fetch the README.md content
          const contentResponse = await rateLimitedRequest(async () => {
            return await retryWithBackoff(async () => {
              return await drive.files.get({
                fileId: readmeId,
                alt: 'media'
              });
            });
          });
          
          // Parse frontmatter from the content
          const { frontmatter, content } = parseFrontmatter(contentResponse.data);
          
          songs[folderName] = {
            title: frontmatter.title || folderName,
            content: contentResponse.data,
            // Include parsed metadata
            ...frontmatter
          };
          
          console.log(`Successfully fetched song: ${folderName}`);
        }
      } catch (folderError) {
        console.error(`Error processing folder ${folderId}:`, folderError.message);
      }
    }
    
    console.log(`Batch fetch completed. Songs fetched: ${Object.keys(songs).length}`);
    res.json({ songs });
  } catch (error) {
    console.error('Batch songs API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 