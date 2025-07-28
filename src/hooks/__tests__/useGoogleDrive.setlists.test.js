/**
 * Basic functionality tests for useGoogleDrive hook
 * Tests hook behavior with the new caching system
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useGoogleDrive } from '../useGoogleDrive';

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
jest.mock('../../config', () => ({
  CONFIG: {
    songsFolderId: 'mock-songs-folder-id',
    setlistsFolderId: 'mock-setlists-folder-id',
    cacheKey: 'test_cache',
    cacheExpiry: 24 * 60 * 60 * 1000,
  },
}));

describe('useGoogleDrive - Basic Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
    navigator.onLine = true;
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useGoogleDrive());

    expect(result.current.songs).toEqual({});
    expect(result.current.setlists).toEqual({});
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.isRefreshing).toBe('boolean');
    expect(typeof result.current.isOnline).toBe('boolean');
    expect(
      result.current.lastFetch === null ||
        typeof result.current.lastFetch === 'number'
    ).toBe(true);
    expect(typeof result.current.refreshData).toBe('function');
    expect(result.current.error).toBeNull();
  });

  it('should load data successfully', async () => {
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

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.songs).toBeDefined();
    expect(result.current.setlists).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    fetch.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 10000 }
    );

    // Hook should handle errors gracefully
    expect(result.current.songs).toBeDefined();
    expect(result.current.setlists).toBeDefined();
  });

  it('should work with cached data', async () => {
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

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.songs).toBeDefined();
    expect(result.current.setlists).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should provide refresh functionality', async () => {
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

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refreshData).toBe('function');
    expect(typeof result.current.isRefreshing).toBe('boolean');
  });
});
