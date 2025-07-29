const { google } = require('googleapis');
const { parseFrontmatter } = require('../utils/frontmatter');

// In-memory cache for Vercel functions (will reset on cold starts)
let cache = {
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

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting - track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

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

const fetchSongsFromDrive = async () => {
  console.log('Fetching songs from Google Drive...');
  const CONFIG = {
    songsFolderId: '1w-jfbKc8pK4qCnak29xdb2cj6SpyxF9m'
  };
  
  const drive = google.drive({
    version: 'v3',
    auth: process.env.GOOGLE_API_KEY
  });
  
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

    console.log(`Found ${folders.length} song folders`);

    for (const folder of folders) {
      console.log(`Processing song folder: "${folder.name}"`);
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
          
          console.log(`✅ Loaded song: "${frontmatter.title || folder.name}" from folder "${folder.name}"`);
        } else {
          console.log(`⚠️ No README.md found in folder "${folder.name}"`);
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
  
  const drive = google.drive({
    version: 'v3',
    auth: process.env.GOOGLE_API_KEY
  });

  const sheets = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_API_KEY
  });
  
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

    console.log(`Found ${files.length} setlist spreadsheets`);

    for (const file of files) {
      console.log(`Processing setlist file: "${file.name}"`);
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
              
              console.log(`✅ Created setlist "${setlistName}" with ${setlists[setlistName].songs.length} songs:`, setlists[setlistName].songs);
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

    console.log('Setlists fetched:', Object.keys(setlists).map(name => `${name}: ${setlists[name].songs.length} songs`));
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

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if API key is configured
  if (!process.env.GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY environment variable is not set');
    return res.status(500).json({ 
      error: 'Google API key not configured. Please set GOOGLE_API_KEY environment variable in Vercel dashboard.' 
    });
  }

  try {
    // If we have valid cache, serve it immediately
    if (isCacheValid() && cache.songs && cache.setlists) {
      console.log('Serving all cached data');
      
      // Start background refresh if needed (but don't wait for it)
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
} 