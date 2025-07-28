const { createMocks } = require('node-mocks-http');

// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        list: jest.fn(),
        get: jest.fn()
      }
    })),
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: jest.fn()
        }
      }
    }))
  }
}));

// Import handlers after mocking
const allHandler = require('../all');
const refreshHandler = require('../refresh');

describe('Vercel Function Caching System', () => {
  let mockDriveList, mockDriveGet, mockSheetsGet;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get mock functions
    const { google } = require('googleapis');
    const driveInstance = google.drive();
    const sheetsInstance = google.sheets();
    
    mockDriveList = driveInstance.files.list;
    mockDriveGet = driveInstance.files.get;
    mockSheetsGet = sheetsInstance.spreadsheets.values.get;
    
    // Mock environment
    process.env.GOOGLE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  describe('/api/data/all Endpoint', () => {
    it('should handle GET requests with successful caching', async () => {
      const { req, res } = createMocks({
        method: 'GET',
      });

      // Mock successful API responses
      mockDriveList
        .mockResolvedValueOnce({
          data: { files: [{ id: 'folder1', name: 'Song1' }] }
        })
        .mockResolvedValueOnce({
          data: { files: [{ id: 'readme1', name: 'README.md' }] }
        })
        .mockResolvedValueOnce({
          data: { files: [{ id: 'sheet1', name: 'Setlist1', mimeType: 'application/vnd.google-apps.spreadsheet' }] }
        });
      
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A'], ['Song B']] }
      });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.songs).toBeDefined();
      expect(data.setlists).toBeDefined();
      expect(data.cached).toBe(false); // First request
      expect(data.lastFetch).toBeDefined();
    });

    it('should serve cached data on subsequent requests', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      const { req: req2, res: res2 } = createMocks({ method: 'GET' });

      // Mock successful API responses
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // First request
      await allHandler.default(req1, res1);
      const data1 = JSON.parse(res1._getData());
      expect(data1.cached).toBe(false);

      // Second request should serve from cache
      await allHandler.default(req2, res2);
      const data2 = JSON.parse(res2._getData());
      expect(data2.cached).toBe(true);
      expect(data2.lastFetch).toBe(data1.lastFetch);
    });

    it('should trigger background refresh when cache is stale', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      
      // Mock successful API responses
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // First request to populate cache
      await allHandler.default(req1, res1);

      // Mock time passing (16 minutes) to trigger background refresh
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 16 * 60 * 1000);

      const { req: req2, res: res2 } = createMocks({ method: 'GET' });
      await allHandler.default(req2, res2);

      const data2 = JSON.parse(res2._getData());
      expect(data2.cached).toBe(true); // Should still serve cache immediately

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle expired cache by fetching fresh data', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      
      // Mock successful API responses
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // First request
      await allHandler.default(req1, res1);
      const data1 = JSON.parse(res1._getData());

      // Mock time passing (31 minutes) to expire cache
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 31 * 60 * 1000);

      const { req: req2, res: res2 } = createMocks({ method: 'GET' });
      await allHandler.default(req2, res2);

      const data2 = JSON.parse(res2._getData());
      expect(data2.cached).toBe(false); // Should fetch fresh data
      expect(data2.lastFetch).toBeGreaterThan(data1.lastFetch);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should fallback to cached data when API fails', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      
      // First successful request
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      await allHandler.default(req1, res1);
      const data1 = JSON.parse(res1._getData());

      // Mock API failure
      mockDriveList.mockRejectedValue(new Error('API Error'));

      // Mock expired cache
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 31 * 60 * 1000);

      const { req: req2, res: res2 } = createMocks({ method: 'GET' });
      await allHandler.default(req2, res2);

      expect(res2._getStatusCode()).toBe(200);
      const data2 = JSON.parse(res2._getData());
      expect(data2.cached).toBe(true);
      expect(data2.error).toBeDefined();
      expect(data2.songs).toEqual(data1.songs);
      expect(data2.setlists).toEqual(data1.setlists);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should return 500 when no cache exists and API fails', async () => {
      const { req, res } = createMocks({ method: 'GET' });

      // Mock API failure
      mockDriveList.mockRejectedValue(new Error('API Error'));

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBeDefined();
    });

    it('should reject non-GET methods', async () => {
      const { req, res } = createMocks({ method: 'POST' });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe('Method not allowed');
    });

    it('should handle missing API key', async () => {
      delete process.env.GOOGLE_API_KEY;
      
      const { req, res } = createMocks({ method: 'GET' });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Google API key not configured');
    });

    it('should include proper CORS headers', async () => {
      const { req, res } = createMocks({ method: 'GET' });

      mockDriveList.mockResolvedValue({ data: { files: [] } });
      mockSheetsGet.mockResolvedValue({ data: { values: [] } });

      await allHandler.default(req, res);

      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(res.getHeader('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(res.getHeader('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should handle OPTIONS requests', async () => {
      const { req, res } = createMocks({ method: 'OPTIONS' });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('/api/data/refresh Endpoint', () => {
    it('should force refresh data regardless of cache state', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      
      // Populate cache first with all endpoint
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      await allHandler.default(req1, res1);

      // Clear mock call counts
      jest.clearAllMocks();

      // Force refresh
      const { req: req2, res: res2 } = createMocks({ method: 'POST' });
      await refreshHandler.default(req2, res2);

      expect(res2._getStatusCode()).toBe(200);
      const data = JSON.parse(res2._getData());
      expect(data.refreshed).toBe(true);
      expect(data.songs).toBeDefined();
      expect(data.setlists).toBeDefined();
      
      // Verify API was called again
      expect(mockDriveList).toHaveBeenCalled();
    });

    it('should only accept POST method', async () => {
      const { req: req1, res: res1 } = createMocks({ method: 'GET' });
      const { req: req2, res: res2 } = createMocks({ method: 'PUT' });

      await refreshHandler.default(req1, res1);
      expect(res1._getStatusCode()).toBe(405);

      await refreshHandler.default(req2, res2);
      expect(res2._getStatusCode()).toBe(405);
    });

    it('should handle API failures during refresh', async () => {
      const { req, res } = createMocks({ method: 'POST' });

      // Mock API failure
      mockDriveList.mockRejectedValue(new Error('API Error'));

      await refreshHandler.default(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBeDefined();
    });

    it('should handle missing API key', async () => {
      delete process.env.GOOGLE_API_KEY;
      
      const { req, res } = createMocks({ method: 'POST' });

      await refreshHandler.default(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Google API key not configured');
    });

    it('should include proper CORS headers', async () => {
      const { req, res } = createMocks({ method: 'POST' });

      mockDriveList.mockResolvedValue({ data: { files: [] } });
      mockSheetsGet.mockResolvedValue({ data: { values: [] } });

      await refreshHandler.default(req, res);

      expect(res.getHeader('Access-Control-Allow-Origin')).toBe('*');
      expect(res.getHeader('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(res.getHeader('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Cache Persistence and Memory Management', () => {
    it('should maintain cache state across multiple function invocations', async () => {
      // Simulate multiple function invocations
      const requests = Array(3).fill().map(() => createMocks({ method: 'GET' }));
      
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // First request should populate cache
      await allHandler.default(requests[0].req, requests[0].res);
      const data1 = JSON.parse(requests[0].res._getData());
      expect(data1.cached).toBe(false);

      // Subsequent requests should use cache
      await allHandler.default(requests[1].req, requests[1].res);
      const data2 = JSON.parse(requests[1].res._getData());
      expect(data2.cached).toBe(true);

      await allHandler.default(requests[2].req, requests[2].res);
      const data3 = JSON.parse(requests[2].res._getData());
      expect(data3.cached).toBe(true);

      // All should have same lastFetch timestamp
      expect(data2.lastFetch).toBe(data1.lastFetch);
      expect(data3.lastFetch).toBe(data1.lastFetch);
    });

    it('should prevent concurrent cache refreshes', async () => {
      // Mock time passing to expire cache
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 31 * 60 * 1000);

      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // Make multiple concurrent requests when cache is expired
      const promises = Array(5).fill().map(() => {
        const { req, res } = createMocks({ method: 'GET' });
        return allHandler.default(req, res);
      });

      await Promise.all(promises);

      // API should only be called once due to isRefreshing flag
      expect(mockDriveList).toHaveBeenCalledTimes(2); // Once for songs, once for setlists

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Rate Limiting and Retry Logic', () => {
    it('should handle rate limiting with exponential backoff', async () => {
      const { req, res } = createMocks({ method: 'GET' });

      // Mock rate limiting error first, then success
      mockDriveList
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue({
          data: { files: [{ id: 'folder1', name: 'Song1' }] }
        });
      
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.songs).toBeDefined();
    });

    it('should handle automated query detection', async () => {
      const { req, res } = createMocks({ method: 'GET' });

      // Mock automated query detection error first, then success
      mockDriveList
        .mockRejectedValueOnce(new Error('automated queries'))
        .mockResolvedValue({
          data: { files: [{ id: 'folder1', name: 'Song1' }] }
        });
      
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      await allHandler.default(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.songs).toBeDefined();
    });
  });
}); 