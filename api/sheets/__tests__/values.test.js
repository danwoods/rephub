const { createMocks } = require('node-mocks-http');
const handler = require('../values').default;

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: jest.fn()
        }
      }
    }))
  }
}));

const { google } = require('googleapis');

describe('/api/sheets/values', () => {
  let mockSheets;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSheets = {
      spreadsheets: {
        values: {
          get: jest.fn()
        }
      }
    };
    google.sheets.mockReturnValue(mockSheets);
    
    // Mock environment variable
    process.env.GOOGLE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  describe('HTTP Method Validation', () => {
    it('should handle OPTIONS requests', async () => {
      const { req, res } = createMocks({
        method: 'OPTIONS'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should reject non-GET requests', async () => {
      const { req, res } = createMocks({
        method: 'POST'
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed'
      });
    });
  });

  describe('API Key Validation', () => {
    it('should return error when API key is not configured', async () => {
      delete process.env.GOOGLE_API_KEY;

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Google API key not configured. Please set GOOGLE_API_KEY environment variable in Vercel dashboard.'
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should return error when spreadsheetId is missing', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'spreadsheetId and range query parameters are required'
      });
    });

    it('should return error when range is missing', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'spreadsheetId and range query parameters are required'
      });
    });
  });

  describe('Successful Requests', () => {
    it('should return spreadsheet values successfully', async () => {
      const mockValues = {
        range: 'Sheet1!A:A',
        majorDimension: 'ROWS',
        values: [
          ['Song 1'],
          ['Song 2'],
          ['Song 3']
        ]
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        status: 200,
        data: mockValues
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Sheet1'
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockValues);
      expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Sheet1'
      });
    });

    it('should handle encoded range parameters', async () => {
      const mockValues = {
        range: 'Sheet 1!A:A',
        values: [['Test']]
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        status: 200,
        data: mockValues
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { 
          spreadsheetId: 'test-id',
          range: 'Sheet%201' // URL encoded "Sheet 1"
        }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
        spreadsheetId: 'test-id',
        range: 'Sheet%201'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.message = 'rate limit';
      mockSheets.spreadsheets.values.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Rate limit exceeded. Please try again later.',
        spreadsheetId: 'test-id',
        range: 'Sheet1'
      });
    });

    it('should handle automated queries detection', async () => {
      const error = new Error('Google detected automated queries');
      mockSheets.spreadsheets.values.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Google detected automated queries. Please try again later.'
      });
    });

    it('should handle permission errors', async () => {
      const error = new Error('Permission forbidden');
      mockSheets.spreadsheets.values.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(403);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Permission denied. Check API key and spreadsheet permissions.'
      });
    });

    it('should handle not found errors', async () => {
      const error = new Error('Sheet not found');
      mockSheets.spreadsheets.values.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'NonExistentSheet' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Spreadsheet or sheet not found. Check the spreadsheet ID and sheet name.'
      });
    });

    it('should handle invalid response data', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        status: 200,
        data: 'invalid-data-type'
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid response from Google Sheets API'
      });
    });
  });

  describe('CORS Headers', () => {
    it('should set correct CORS headers', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        status: 200,
        data: { values: [['Test']] }
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id', range: 'Sheet1' }
      });

      await handler(req, res);

      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(res.getHeader('Access-Control-Allow-Headers')).toBe('Origin, X-Requested-With, Content-Type, Accept');
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });
  });
}); 