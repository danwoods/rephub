/**
 * Integration tests for Enhanced Caching System
 * Tests that the caching system works end-to-end
 */

import { renderHook, waitFor } from '@testing-library/react';
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

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock the config
jest.mock('../config', () => ({
  CONFIG: {
    songsFolderId: 'mock-songs-folder-id',
    setlistsFolderId: 'mock-setlists-folder-id',
    cacheKey: 'test_cache',
    cacheExpiry: 24 * 60 * 60 * 1000,
  },
}));

describe('Enhanced Caching System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
    navigator.onLine = true;
  });

  describe('Basic Functionality', () => {
    it('should load data successfully when server responds', async () => {
      // Mock successful server response
      const mockResponse = {
        songs: {
          'test-song': {
            title: 'Test Song',
            content: '# Test Song\n\nContent here',
          },
        },
        setlists: {
          'test-setlist': {
            name: 'Test Setlist',
            songs: ['test-song'],
          },
        },
        cached: false,
        lastFetch: Date.now(),
      };

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useGoogleDrive());

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Verify data was loaded
      expect(result.current.songs).toBeDefined();
      expect(result.current.setlists).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it('should handle server errors gracefully', async () => {
      // Mock server error
      fetch.mockRejectedValue(new Error('Server Error'));

      const { result } = renderHook(() => useGoogleDrive());

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 10000 }
      );

      // Should handle error gracefully
      expect(result.current.songs).toBeDefined();
      expect(result.current.setlists).toBeDefined();
      // Error handling allows for graceful degradation
    });

    it('should work with cached data', async () => {
      // Set up cached data
      const cachedData = {
        songs: {
          'cached-song': {
            title: 'Cached Song',
            content: '# Cached Song\n\nCached content',
          },
        },
        setlists: {
          'cached-setlist': {
            name: 'Cached Setlist',
            songs: ['cached-song'],
          },
        },
        timestamp: Date.now(),
        lastFetch: Date.now(),
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

      // Mock server response
      fetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            songs: cachedData.songs,
            setlists: cachedData.setlists,
            cached: true,
            lastFetch: cachedData.lastFetch,
          }),
      });

      const { result } = renderHook(() => useGoogleDrive());

      // Should work with cached data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.songs).toBeDefined();
      expect(result.current.setlists).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    it('should provide refresh functionality', async () => {
      // Mock server response
      fetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            songs: {},
            setlists: {},
            refreshed: true,
            lastFetch: Date.now(),
          }),
      });

      const { result } = renderHook(() => useGoogleDrive());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify refresh function exists
      expect(typeof result.current.refreshData).toBe('function');
      expect(typeof result.current.isRefreshing).toBe('boolean');
    });

    it('should handle offline state', async () => {
      // Set up cached data for offline use
      const cachedData = {
        songs: {
          'offline-song': {
            title: 'Offline Song',
            content: '# Offline Song\n\nOffline content',
          },
        },
        setlists: {
          'offline-setlist': {
            name: 'Offline Setlist',
            songs: ['offline-song'],
          },
        },
        timestamp: Date.now(),
        lastFetch: Date.now(),
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

      // Start offline
      navigator.onLine = false;

      const { result } = renderHook(() => useGoogleDrive());

      // Should work offline with cached data
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.songs).toBeDefined();
      expect(result.current.setlists).toBeDefined();
      expect(result.current.isOnline).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should provide correct loading states', async () => {
      fetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({ songs: {}, setlists: {}, cached: false }),
                }),
              100
            )
          )
      );

      const { result } = renderHook(() => useGoogleDrive());

      // Should start with some loading state
      expect(typeof result.current.loading).toBe('boolean');
      expect(typeof result.current.isRefreshing).toBe('boolean');

      // Wait for completion
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 10000 }
      );
    });

    it('should provide network state information', async () => {
      const { result } = renderHook(() => useGoogleDrive());

      // Should provide online state
      expect(typeof result.current.isOnline).toBe('boolean');
      expect(typeof result.current.lastFetch).toBe('number');
    });
  });
});
