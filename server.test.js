const request = require('supertest');
const express = require('express');

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

// Import server after mocking
const app = require('./server');

describe('Server-Side Caching System', () => {
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
    
    // Reset server cache by requiring fresh instance
    delete require.cache[require.resolve('./server')];
  });

  describe('Cache TTL and Background Refresh', () => {
    it('should serve cached data immediately within TTL period', async () => {
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

      // First request - should fetch from Google APIs
      const response1 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response1.body.cached).toBe(false);
      expect(response1.body.songs).toBeDefined();
      expect(response1.body.setlists).toBeDefined();
      expect(response1.body.lastFetch).toBeDefined();

      // Second request immediately after - should serve from cache
      const response2 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response2.body.cached).toBe(true);
      expect(response2.body.lastFetch).toBe(response1.body.lastFetch);
      
      // Verify API was called only once (for the first request)
      expect(mockDriveList).toHaveBeenCalledTimes(2); // Once for songs, once for setlists
    });

    it('should trigger background refresh after 15 minutes while serving cache', async () => {
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
      await request(app)
        .get('/api/data/all')
        .expect(200);

      // Mock time passing (16 minutes)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 16 * 60 * 1000);

      // Second request - should serve cache AND trigger background refresh
      const response = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response.body.cached).toBe(true);
      
      // Wait a bit for background refresh to potentially start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should fetch fresh data when cache expires (30+ minutes)', async () => {
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
      const response1 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response1.body.cached).toBe(false);

      // Mock time passing (31 minutes)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 31 * 60 * 1000);

      // Second request - should fetch fresh data
      const response2 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response2.body.cached).toBe(false);
      expect(response2.body.lastFetch).toBeGreaterThan(response1.body.lastFetch);
      
      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Error Handling with Cache Fallback', () => {
    it('should serve cached data when API fails', async () => {
      // First successful request to populate cache
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      const response1 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response1.body.cached).toBe(false);

      // Mock API failure for subsequent requests
      mockDriveList.mockRejectedValue(new Error('API Error'));

      // Mock time passing to expire cache
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 31 * 60 * 1000);

      // Request should still return cached data with error flag
      const response2 = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response2.body.cached).toBe(true);
      expect(response2.body.error).toBeDefined();
      expect(response2.body.songs).toEqual(response1.body.songs);
      expect(response2.body.setlists).toEqual(response1.body.setlists);

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should return 500 error when no cache exists and API fails', async () => {
      // Mock API failure
      mockDriveList.mockRejectedValue(new Error('API Error'));

      // Request with no existing cache should return error
      await request(app)
        .get('/api/data/all')
        .expect(500);
    });
  });

  describe('Manual Refresh Endpoint', () => {
    it('should force refresh data regardless of cache state', async () => {
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

      // Populate cache first
      await request(app)
        .get('/api/data/all')
        .expect(200);

      // Clear mock call counts
      jest.clearAllMocks();

      // Force refresh should fetch fresh data
      const response = await request(app)
        .post('/api/data/refresh')
        .expect(200);
      
      expect(response.body.refreshed).toBe(true);
      expect(response.body.songs).toBeDefined();
      expect(response.body.setlists).toBeDefined();
      
      // Verify API was called again
      expect(mockDriveList).toHaveBeenCalled();
    });

    it('should only accept POST method', async () => {
      await request(app)
        .get('/api/data/refresh')
        .expect(405);
      
      await request(app)
        .put('/api/data/refresh')
        .expect(405);
    });
  });

  describe('Individual Endpoint Caching', () => {
    it('should cache songs endpoint independently', async () => {
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });

      // First request should fetch from API
      const response1 = await request(app)
        .get('/api/data/songs')
        .expect(200);
      
      expect(response1.body.cached).toBe(false);
      expect(response1.body.songs).toBeDefined();

      // Second request should serve from cache
      const response2 = await request(app)
        .get('/api/data/songs')
        .expect(200);
      
      expect(response2.body.cached).toBe(true);
    });

    it('should cache setlists endpoint independently', async () => {
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'sheet1', name: 'Setlist1', mimeType: 'application/vnd.google-apps.spreadsheet' }] }
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // First request should fetch from API
      const response1 = await request(app)
        .get('/api/data/setlists')
        .expect(200);
      
      expect(response1.body.cached).toBe(false);
      expect(response1.body.setlists).toBeDefined();

      // Second request should serve from cache
      const response2 = await request(app)
        .get('/api/data/setlists')
        .expect(200);
      
      expect(response2.body.cached).toBe(true);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests without duplicate API calls', async () => {
      mockDriveList.mockResolvedValue({
        data: { files: [{ id: 'folder1', name: 'Song1' }] }
      });
      mockDriveGet.mockResolvedValue({
        data: '# Song Content'
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [['Song A']] }
      });

      // Make multiple concurrent requests
      const promises = Array(5).fill().map(() => 
        request(app).get('/api/data/all').expect(200)
      );

      const responses = await Promise.all(promises);

      // All responses should have data
      responses.forEach(response => {
        expect(response.body.songs).toBeDefined();
        expect(response.body.setlists).toBeDefined();
      });

      // API should only be called once due to isRefreshing flag
      expect(mockDriveList).toHaveBeenCalledTimes(2); // Once for songs, once for setlists
    });
  });

  describe('CORS Headers', () => {
    it('should include proper CORS headers', async () => {
      mockDriveList.mockResolvedValue({
        data: { files: [] }
      });
      mockSheetsGet.mockResolvedValue({
        data: { values: [] }
      });

      const response = await request(app)
        .get('/api/data/all')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should handle OPTIONS requests', async () => {
      await request(app)
        .options('/api/data/all')
        .expect(200);
    });
  });
}); 