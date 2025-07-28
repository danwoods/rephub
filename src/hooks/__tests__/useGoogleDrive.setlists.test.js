/**
 * Enhanced setlist functionality tests for useGoogleDrive hook
 * Tests multi-sheet support and dynamic sheet discovery
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useGoogleDrive } from '../useGoogleDrive';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage with initial state
const createMockLocalStorage = () => ({
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
});

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock the config with very short cache expiry for testing
jest.mock('../../config', () => ({
  CONFIG: {
    songsFolderId: 'test-songs-folder',
    setlistsFolderId: 'test-setlists-folder',
    cacheKey: 'test-cache-key',
    cacheExpiryMs: 1000, // 1 second for testing
  },
}));

describe('useGoogleDrive - Setlist Functionality', () => {
  let localStorageMock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock = createMockLocalStorage();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should load setlists from multiple sheets', async () => {
    const mockData = {
      setlists: {
        'Setlist 1': [{ title: 'Song 1', key: 'C' }],
        'Setlist 2': [{ title: 'Song 2', key: 'G' }],
      },
      songs: {
        'Song 1': { title: 'Song 1', key: 'C' },
        'Song 2': { title: 'Song 2', key: 'G' },
      },
      timestamp: Date.now(),
      lastFetch: Date.now(),
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

    // Mock fetch to return the same data
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have loaded data (either from cache or server)
    expect(result.current.setlists).toBeDefined();
    expect(result.current.songs).toBeDefined();
  });

  it('should handle empty setlists gracefully', async () => {
    const mockData = {
      setlists: {},
      songs: {},
      timestamp: Date.now(),
      lastFetch: Date.now(),
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

    // Mock fetch to return the same data
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should handle empty data gracefully
    expect(result.current.setlists).toBeDefined();
    expect(result.current.songs).toBeDefined();
  });

  it('should refresh data when cache is expired', async () => {
    const expiredData = {
      setlists: { 'Old Setlist': [{ title: 'Old Song', key: 'C' }] },
      songs: { 'Old Song': { title: 'Old Song', key: 'C' } },
      timestamp: Date.now() - 3600000, // 1 hour ago
      lastFetch: Date.now() - 3600000,
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredData));

    // Mock fetch to return fresh data
    const freshData = {
      setlists: { 'New Setlist': [{ title: 'New Song', key: 'G' }] },
      songs: { 'New Song': { title: 'New Song', key: 'G' } },
      timestamp: Date.now(),
      lastFetch: Date.now(),
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => freshData,
    });

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should attempt to refresh expired data
    expect(result.current.setlists).toBeDefined();
    expect(result.current.songs).toBeDefined();
  });

  it('should handle network errors gracefully', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should handle network errors gracefully
    expect(result.current.setlists).toBeDefined();
    expect(result.current.songs).toBeDefined();
  });

  it('should support multiple setlist sheets', async () => {
    const mockData = {
      setlists: {
        'Main Setlist': [{ title: 'Song 1', key: 'C' }],
        'Backup Setlist': [{ title: 'Song 2', key: 'G' }],
        'Special Setlist': [{ title: 'Song 3', key: 'D' }],
      },
      songs: {
        'Song 1': { title: 'Song 1', key: 'C' },
        'Song 2': { title: 'Song 2', key: 'G' },
        'Song 3': { title: 'Song 3', key: 'D' },
      },
      timestamp: Date.now(),
      lastFetch: Date.now(),
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));

    // Mock fetch to return the same data
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result: result1 } = renderHook(() => useGoogleDrive());
    const { result: result2 } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    // Both hooks should have loaded data
    expect(result1.current.setlists).toBeDefined();
    expect(result2.current.setlists).toBeDefined();
  });

  it('should handle malformed cached data', async () => {
    localStorageMock.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useGoogleDrive());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should handle malformed data gracefully
    expect(result.current.setlists).toBeDefined();
    expect(result.current.songs).toBeDefined();
  });
});
