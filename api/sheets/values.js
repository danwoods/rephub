const { google } = require('googleapis');

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

  const { spreadsheetId, range } = req.query;
  
  if (!spreadsheetId || !range) {
    return res.status(400).json({ error: 'spreadsheetId and range query parameters are required' });
  }

  try {
    // Initialize Google Sheets API
    const sheets = google.sheets({
      version: 'v4',
      auth: process.env.GOOGLE_API_KEY
    });

    console.log('Sheets API values request:', { spreadsheetId, range });
    
    const response = await rateLimitedRequest(async () => {
      return await retryWithBackoff(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: range
        });
      });
    });
    
    console.log('Sheets API values response:', response.data);
    
    // Ensure we're returning valid JSON
    if (response.data && typeof response.data === 'object') {
      res.json(response.data);
    } else {
      console.error('Invalid response data type:', typeof response.data);
      res.status(500).json({ error: 'Invalid response from Google Sheets API' });
    }
  } catch (error) {
    console.error('Sheets API error:', error.message);
    console.error('Sheets API error details:', error);
    
    // Check for specific error types
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes('automated queries')) {
      errorMessage = 'Google detected automated queries. Please try again later.';
      statusCode = 429;
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
      errorMessage = 'Permission denied. Check API key and spreadsheet permissions.';
      statusCode = 403;
    } else if (error.message.includes('not found')) {
      errorMessage = 'Spreadsheet or sheet not found. Check the spreadsheet ID and sheet name.';
      statusCode = 404;
    }
    
    // Return plain JSON error response
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      spreadsheetId: spreadsheetId,
      range: range
    });
  }
} 