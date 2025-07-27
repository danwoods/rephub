const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = 3000;

// Initialize Google Drive API
const drive = google.drive({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY || 'AIzaSyCzmV05PTAIGZwPkKlIyoJU_s6-MxtlhuQ'
});

// Initialize Google Sheets API
const sheets = google.sheets({
  version: 'v4',
  auth: process.env.GOOGLE_API_KEY || 'AIzaSyCzmV05PTAIGZwPkKlIyoJU_s6-MxtlhuQ'
});

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting - track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 seconds between requests

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
      return await requestFn();
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 2^attempt seconds
      const backoffTime = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${backoffTime}ms...`);
      await delay(backoffTime);
    }
  }
};

// API routes for Google Drive
app.get('/api/drive/files', async (req, res) => {
  try {
    const { q, fields } = req.query;
    console.log('Drive API request:', { q, fields });
    
    const response = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await drive.files.list({
          q: q,
          fields: fields,
          pageSize: 100
        });
      });
    });
    
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
    
    res.json(response.data);
  } catch (error) {
    console.error('Sheets API error:', error.message);
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