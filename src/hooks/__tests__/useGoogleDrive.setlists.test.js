import { renderHook, waitFor } from '@testing-library/react';
import { useGoogleDrive } from '../useGoogleDrive';

// Mock fetch globally
global.fetch = jest.fn();

// Mock the config
jest.mock('../../config', () => ({
  CONFIG: {
    songsFolderId: 'mock-songs-folder-id',
    setlistsFolderId: 'mock-setlists-folder-id',
    cacheKey: 'test_cache',
    cacheExpiry: 24 * 60 * 60 * 1000,
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('useGoogleDrive - Setlists Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Setlist Fetching Flow', () => {
    it('should successfully fetch setlists with metadata-driven sheet names', async () => {
      // Mock the Drive API response for setlist files
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'My Concert Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      // Mock the metadata API response
      const mockMetadata = {
        properties: { title: 'My Concert Setlist' },
        sheets: [
          { properties: { title: 'Main Set' } },
          { properties: { title: 'Encore' } },
        ],
      };

      // Mock the values API response
      const mockValues = {
        range: 'Main Set!A:A',
        values: [['Song 1'], ['Song 2'], ['Song 3']],
      };

      // Mock songs response (empty to focus on setlists)
      const mockSongsResponse = { files: [] };

      // Setup fetch mock responses
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

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify the setlist was processed correctly
      expect(result.current.setlists).toEqual({
        'My Concert Setlist': {
          name: 'My Concert Setlist',
          songs: ['Song 1', 'Song 2', 'Song 3'],
        },
      });

      // Verify API calls were made correctly
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/metadata?spreadsheetId=test-spreadsheet-id'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=test-spreadsheet-id&range=Main%20Set'
      );
    });

    it('should handle metadata parsing errors gracefully', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'Test Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockSongsResponse = { files: [] };

      // Mock successful songs/setlist discovery but failed metadata
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
          text: () => Promise.resolve('<!doctype html><html>Error page</html>'),
        });

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should handle the error and continue without crashing
      expect(result.current.setlists).toEqual({});
      expect(result.current.error).toBeNull(); // Should not set global error for individual setlist failures
    });

    it('should fall back to default sheet names when metadata fails', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'Test Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockValues = {
        range: 'Sheet1!A:A',
        values: [['Fallback Song']],
      };

      const mockSongsResponse = { files: [] };

      // Mock metadata failure but successful values fetch with fallback name
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
          ok: false,
          text: () => Promise.resolve('Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockValues)),
        });

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should successfully get data using fallback sheet names
      expect(result.current.setlists).toEqual({
        'Test Setlist': {
          name: 'Test Setlist',
          songs: ['Fallback Song'],
        },
      });
    });

    it('should handle HTML error responses from API', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'Test Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockSongsResponse = { files: [] };

      // Mock HTML response (like we were getting before the fix)
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
          text: () => Promise.resolve('<!doctype html><html>Error page</html>'),
        });

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should detect HTML and skip the setlist
      expect(result.current.setlists).toEqual({});
    });

    it('should try multiple sheet names when first ones fail', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'Test Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockMetadata = {
        properties: { title: 'Test Setlist' },
        sheets: [
          { properties: { title: 'Custom Sheet' } },
          { properties: { title: 'Songs' } },
        ],
      };

      const mockValues = {
        range: 'Songs!A:A',
        values: [['Found Song']],
      };

      const mockSongsResponse = { files: [] };

      // Mock first sheet failing, second succeeding
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
          ok: false,
          text: () => Promise.resolve('Sheet not found'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockValues)),
        });

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should successfully get data from the second sheet
      expect(result.current.setlists).toEqual({
        'Test Setlist': {
          name: 'Test Setlist',
          songs: ['Found Song'],
        },
      });

      // Should have tried both sheets
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=test-spreadsheet-id&range=Custom%20Sheet'
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/sheets/values?spreadsheetId=test-spreadsheet-id&range=Songs'
      );
    });

    it('should filter out empty song titles', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'test-spreadsheet-id',
            name: 'Test Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockMetadata = {
        properties: { title: 'Test Setlist' },
        sheets: [{ properties: { title: 'Sheet1' } }],
      };

      // Mock values with empty cells and whitespace
      const mockValues = {
        range: 'Sheet1!A:A',
        values: [
          ['Song 1'],
          [''], // Empty string
          ['Song 2'],
          ['   '], // Just whitespace
          ['Song 3'],
          [], // Empty array
        ],
      };

      const mockSongsResponse = { files: [] };

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

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only include non-empty, non-whitespace songs
      expect(result.current.setlists).toEqual({
        'Test Setlist': {
          name: 'Test Setlist',
          songs: ['Song 1', 'Song 2', 'Song 3'],
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockSongsResponse = { files: [] };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSongsResponse),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.setlists).toEqual({});
      expect(result.current.error).toContain('Network error');
    });

    it('should continue processing other setlists when one fails', async () => {
      const mockSetlistFiles = {
        files: [
          {
            id: 'good-spreadsheet-id',
            name: 'Good Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
          {
            id: 'bad-spreadsheet-id',
            name: 'Bad Setlist',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      };

      const mockGoodMetadata = {
        properties: { title: 'Good Setlist' },
        sheets: [{ properties: { title: 'Sheet1' } }],
      };

      const mockGoodValues = {
        range: 'Sheet1!A:A',
        values: [['Good Song']],
      };

      const mockSongsResponse = { files: [] };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSongsResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetlistFiles),
        })
        // Good setlist - metadata
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockGoodMetadata)),
        })
        // Good setlist - values
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockGoodValues)),
        })
        // Bad setlist - metadata fails
        .mockRejectedValueOnce(new Error('Metadata error'));

      const { result } = renderHook(() => useGoogleDrive());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still have the good setlist
      expect(result.current.setlists).toEqual({
        'Good Setlist': {
          name: 'Good Setlist',
          songs: ['Good Song'],
        },
      });
    });
  });
});
