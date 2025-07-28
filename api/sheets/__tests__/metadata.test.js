const { createMocks } = require('node-mocks-http');
const handler = require('../metadata').default;

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => ({
      spreadsheets: {
        get: jest.fn()
      }
    }))
  }
}));

const { google } = require('googleapis');

describe('/api/sheets/metadata', () => {
  let mockSheets;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSheets = {
      spreadsheets: {
        get: jest.fn()
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
        query: { spreadsheetId: 'test-id' }
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
        query: {}
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'spreadsheetId query parameter is required'
      });
    });
  });

  describe('Successful Requests', () => {
    it('should return spreadsheet metadata successfully', async () => {
      const mockMetadata = {
        properties: {
          title: 'Test Spreadsheet'
        },
        sheets: [
          { properties: { title: 'Sheet1' } },
          { properties: { title: 'Data' } }
        ]
      };

      mockSheets.spreadsheets.get.mockResolvedValue({
        status: 200,
        data: mockMetadata
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-spreadsheet-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual(mockMetadata);
      expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        fields: 'properties,sheets.properties'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.message = 'rate limit';
      mockSheets.spreadsheets.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Rate limit exceeded. Please try again later.',
        spreadsheetId: 'test-id',
        requestType: 'metadata'
      });
    });

    it('should handle automated queries detection', async () => {
      const error = new Error('Google detected automated queries');
      mockSheets.spreadsheets.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Google detected automated queries. Please try again later.'
      });
    });

    it('should handle permission errors', async () => {
      const error = new Error('Permission denied');
      mockSheets.spreadsheets.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(403);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Permission denied. Check API key and spreadsheet permissions.'
      });
    });

    it('should handle not found errors', async () => {
      const error = new Error('Spreadsheet not found');
      mockSheets.spreadsheets.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(404);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Spreadsheet not found. Check the spreadsheet ID.'
      });
    });

    it('should handle invalid response data', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        status: 200,
        data: 'invalid-data-type'
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Invalid response from Google Sheets API'
      });
    });

    it('should handle generic errors', async () => {
      const error = new Error('Something went wrong');
      mockSheets.spreadsheets.get.mockRejectedValue(error);

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toMatchObject({
        error: 'Something went wrong',
        spreadsheetId: 'test-id',
        requestType: 'metadata'
      });
    });
  });

  describe('CORS Headers', () => {
    it('should set correct CORS headers', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        status: 200,
        data: { properties: { title: 'Test' } }
      });

      const { req, res } = createMocks({
        method: 'GET',
        query: { spreadsheetId: 'test-id' }
      });

      await handler(req, res);

      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(res.getHeader('Access-Control-Allow-Headers')).toBe('Origin, X-Requested-With, Content-Type, Accept');
      expect(res.getHeader('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    });
  });
}); 