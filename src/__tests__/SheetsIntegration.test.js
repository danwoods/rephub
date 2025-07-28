/**
 * Integration tests for Google Sheets API functionality
 * Tests the complete flow from API endpoints to React hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock the config
jest.mock('../config', () => ({
  CONFIG: {
    songsFolderId: 'mock-songs-folder-id',
    setlistsFolderId: 'mock-setlists-folder-id',
    cacheKey: 'test_cache',
    cacheExpiry: 24 * 60 * 60 * 1000,
  },
}));

describe('Google Sheets Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    // Ensure localStorage returns null to force fresh API calls
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('End-to-End Setlist Fetching', () => {
    it('should complete the full setlist fetching workflow successfully', async () => {
      // Mock complete workflow responses
      const mockSongsFoldersResponse = {
        files: [
          {
            id: 'folder-1',
            name: 'Summer Tour 2024',
          },
          {
            id: 'folder-2',
            name: 'Acoustic Set',
          },
        ],
      };

      const mockBatchSongsResponse = {
        songs: {
          'Summer Tour 2024': {
            name: 'Summer Tour 2024',
            content: 'Song content for Summer Tour',
          },
          'Acoustic Set': {
            name: 'Acoustic Set',
            content: 'Song content for Acoustic Set',
          },
        },
      };

      const mockSetlistFiles = {
        files: [
          {
            id: 'setlist-1',
            name: 'Summer Tour 2024',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
          {
            id: 'setlist-2',
            name: 'Acoustic Set',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockMetadata1 = {
        properties: { title: 'Summer Tour 2024' },
        sheets: [
          { properties: { title: 'Set 1' } },
          { properties: { title: 'Set 2' } },
          { properties: { title: 'Encore' } },
        ],
      };

      const mockMetadata2 = {
        properties: { title: 'Acoustic Set' },
        sheets: [{ properties: { title: 'Main Set' } }],
      };

      const mockValues1 = {
        range: 'Set 1!A:A',
        values: [['Shakedown Street'], ['Fire on the Mountain'], ['Drums']],
      };

      const mockValues2 = {
        range: 'Main Set!A:A',
        values: [['Ripple'], ['Uncle Johns Band'], ['Amazing Grace']],
      };

      // Setup complete fetch mock sequence to match actual hook calls
      fetch.mockImplementation((url) => {
        if (
          url.includes('/api/drive/files?q=') &&
          url.includes("mimeType='application/vnd.google-apps.folder'")
        ) {
          // Songs folders fetch
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockSongsFoldersResponse),
          });
        } else if (url.includes('/api/drive/batch-songs')) {
          // Batch songs fetch
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockBatchSongsResponse),
          });
        } else if (
          url.includes('/api/drive/files?q=') &&
          url.includes("mimeType='application/vnd.google-apps.spreadsheet'")
        ) {
          // Setlists files fetch
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockSetlistFiles),
          });
        } else if (
          url.includes('/api/sheets/metadata?spreadsheetId=setlist-1')
        ) {
          // First setlist metadata
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockMetadata1)),
          });
        } else if (
          url.includes(
            '/api/sheets/values?spreadsheetId=setlist-1&range=Set%201'
          )
        ) {
          // First setlist values
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockValues1)),
          });
        } else if (
          url.includes('/api/sheets/metadata?spreadsheetId=setlist-2')
        ) {
          // Second setlist metadata
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockMetadata2)),
          });
        } else if (
          url.includes(
            '/api/sheets/values?spreadsheetId=setlist-2&range=Main%20Set'
          )
        ) {
          // Second setlist values
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify(mockValues2)),
          });
        } else {
          // Fallback for any unexpected calls
          return Promise.resolve({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Not found'),
          });
        }
      });

      const { result } = renderHook(() => useGoogleDrive());

      // Force refresh to bypass cache
      await act(async () => {
        result.current.refreshData();
      });

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 5000 }
      );

      // Verify both setlists were processed correctly
      expect(result.current.setlists).toEqual({
        'Summer Tour 2024': {
          name: 'Summer Tour 2024',
          songs: ['Shakedown Street', 'Fire on the Mountain', 'Drums'],
        },
        'Acoustic Set': {
          name: 'Acoustic Set',
          songs: ['Ripple', 'Uncle Johns Band', 'Amazing Grace'],
        },
      });

      // Verify songs were fetched too
      expect(result.current.songs).toEqual({
        'Summer Tour 2024': {
          title: 'Summer tour 2024',
          content: 'Song content for Summer Tour',
        },
        'Acoustic Set': {
          title: 'Acoustic set',
          content: 'Song content for Acoustic Set',
        },
      });

      // Verify all API calls were made with correct endpoints
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/drive/files?q=')
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/drive/batch-songs?folderIds=folder-1,folder-2'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/metadata?spreadsheetId=setlist-1'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=setlist-1&range=Set%201'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/metadata?spreadsheetId=setlist-2'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=setlist-2&range=Main%20Set'
      );

      expect(result.current.error).toBeNull();
    });

    it('should handle mixed success/failure scenarios gracefully', async () => {
      const mockSongsResponse = { files: [] };

      const mockSetlistFiles = {
        files: [
          {
            id: 'working-setlist',
            name: 'Working Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
          {
            id: 'broken-setlist',
            name: 'Broken Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockWorkingMetadata = {
        properties: { title: 'Working Setlist' },
        sheets: [{ properties: { title: 'Songs' } }],
      };

      const mockWorkingValues = {
        range: 'Songs!A:A',
        values: [['Working Song']],
      };

      fetch
        // Songs fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSongsResponse),
        })
        // Setlist files fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetlistFiles),
        })
        // Working setlist metadata
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockWorkingMetadata)),
        })
        // Working setlist values
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockWorkingValues)),
        })
        // Broken setlist metadata - returns HTML error
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<!doctype html><html>API Error</html>'),
        });

      const { result } = renderHook(() => useGoogleDrive());

      // Force refresh to bypass cache
      await act(async () => {
        result.current.refreshData();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have the working setlist but not the broken one
      expect(result.current.setlists).toEqual({
        'Working Setlist': {
          name: 'Working Setlist',
          songs: ['Working Song'],
        },
      });

      // Should not set a global error for individual setlist failures
      expect(result.current.error).toBeNull();
    });

    it('should properly URL encode sheet names with special characters', async () => {
      const mockSongsResponse = { files: [] };

      const mockSetlistFiles = {
        files: [
          {
            id: 'special-chars-setlist',
            name: 'Special Characters',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockMetadata = {
        properties: { title: 'Special Characters' },
        sheets: [
          { properties: { title: 'Set 1 & 2' } }, // Contains &
          { properties: { title: 'Songs (Encore)' } }, // Contains parentheses
        ],
      };

      const mockValues = {
        range: 'Set 1 & 2!A:A',
        values: [['Test Song']],
      };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSongsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetlistFiles),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockMetadata)),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockValues)),
        });

      const { result } = renderHook(() => useGoogleDrive());

      // Force refresh to bypass cache
      await act(async () => {
        result.current.refreshData();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify URL encoding of sheet name with special characters
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=special-chars-setlist&range=Set%201%20%26%202'
      );

      expect(result.current.setlists).toEqual({
        'Special Characters': {
          name: 'Special Characters',
          songs: ['Test Song'],
        },
      });
    });
  });

  describe('Regression Tests', () => {
    it('should not return HTML content instead of JSON (original bug)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockSongsFoldersResponse = { files: [] }; // No song folders
      const mockSetlistFiles = {
        files: [
          {
            id: 'html-response-test',
            name: 'HTML Response Test',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      fetch
        // 1. Songs folders fetch (empty)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSongsFoldersResponse),
        })
        // 2. Setlist files fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSetlistFiles),
        })
        // 3. Return HTML instead of JSON (the original bug)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              '<!doctype html><html><head><title>Error</title></head><body>API Error</body></html>'
            ),
        });

      const { result } = renderHook(() => useGoogleDrive());

      // Force refresh to bypass cache
      await act(async () => {
        result.current.refreshData();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not crash or return malformed data
      expect(result.current.setlists).toEqual({});

      // Should log the error appropriately
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Metadata request returned HTML instead of JSON'
        )
      );

      consoleSpy.mockRestore();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockSongsFoldersResponse = { files: [] }; // No song folders
      const mockSetlistFiles = {
        files: [
          {
            id: 'invalid-json-test',
            name: 'Invalid JSON Test',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      fetch
        // 1. Songs folders fetch (empty)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSongsFoldersResponse),
        })
        // 2. Setlist files fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSetlistFiles),
        })
        // 3. Return invalid JSON for metadata
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"invalid": json}'), // Missing quotes around "json"
        });

      const { result } = renderHook(() => useGoogleDrive());

      // Force refresh to bypass cache
      await act(async () => {
        result.current.refreshData();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should handle parse error gracefully
      expect(result.current.setlists).toEqual({});

      // Should log the parsing error - check that the first parameter contains the expected text
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing metadata for Invalid JSON Test'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
