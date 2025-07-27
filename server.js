const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = 3000; // Back to original port

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
          
          songs[folderName] = {
            title: folderName, // Will be updated by frontend parsing
            content: contentResponse.data
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