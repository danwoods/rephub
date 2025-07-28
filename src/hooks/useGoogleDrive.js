import { useState, useEffect, useCallback, useRef } from 'react';
import { CONFIG } from '../config';

export function useGoogleDrive() {
  const [songs, setSongs] = useState({});
  const [setlists, setSetlists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const backgroundRefreshTimeoutRef = useRef(null);

  // Enhanced cache management
  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(CONFIG.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          songs: data.songs || {},
          setlists: data.setlists || {},
          timestamp: data.timestamp,
          lastFetch: data.lastFetch,
        };
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
    return null;
  }, []);

  const saveCachedData = useCallback((data, serverLastFetch = null) => {
    try {
      const cacheData = {
        songs: data.songs || {},
        setlists: data.setlists || {},
        timestamp: Date.now(),
        lastFetch: serverLastFetch || Date.now(),
      };
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheData));
      setLastFetch(cacheData.lastFetch);
    } catch (error) {
      console.error('Error saving cached data:', error);
    }
  }, []);

  // Main data loading function - React Query style
  const loadData = useCallback(
    async (forceRefresh = false) => {
      console.log('loadData called', { forceRefresh, isOnline });

      // Always show cached data immediately if available
      const cachedData = loadCachedData();
      if (cachedData && (cachedData.songs || cachedData.setlists)) {
        console.log('Showing cached data immediately');
        setSongs(cachedData.songs);
        setSetlists(cachedData.setlists);
        setLastFetch(cachedData.lastFetch);
        setLoading(false); // Remove loading state since we have data to show
      }

      // If offline, only use cached data
      if (!isOnline) {
        console.log('Offline - using cached data only');
        if (!cachedData) {
          setError('No cached data available offline');
          setLoading(false);
        }
        return;
      }

      // If we have recent cached data and not forcing refresh, we're done
      if (!forceRefresh && cachedData && cachedData.timestamp) {
        const age = Date.now() - cachedData.timestamp;
        if (age < CONFIG.cacheExpiry) {
          console.log('Using recent cached data, skipping server request');
          setLoading(false);
          return;
        }
      }

      // Fetch from server (will be instant if server has cached data)
      setIsRefreshing(true);
      setError(null);

      try {
        const endpoint = forceRefresh ? '/api/data/refresh' : '/api/data/all';
        const method = forceRefresh ? 'POST' : 'GET';

        const response = await fetch(endpoint, { method });

        if (!response.ok) {
          throw new Error(`Server request failed: ${response.status}`);
        }

        const serverData = await response.json();

        // Update state with fresh data
        setSongs(serverData.songs || {});
        setSetlists(serverData.setlists || {});

        // Save to cache
        saveCachedData(
          {
            songs: serverData.songs || {},
            setlists: serverData.setlists || {},
          },
          serverData.lastFetch
        );

        // Handle server errors while still showing data
        if (serverData.error) {
          console.warn(
            'Server had errors but returned cached data:',
            serverData.error
          );
          setError(`Warning: ${serverData.error} (showing cached data)`);
        } else {
          setError(null);
        }

        console.log('Data loaded successfully from server');
      } catch (serverError) {
        console.error('Server fetch failed:', serverError);

        // If server fails but we have cached data, that's okay
        if (cachedData) {
          console.log('Server failed but using cached data');
          setError(`Server unavailable (showing cached data)`);
        } else {
          console.log('Server failed and no cached data available');
          setError(`Failed to load data: ${serverError.message}`);
        }
      } finally {
        setIsRefreshing(false);
        setLoading(false);
      }
    },
    [loadCachedData, saveCachedData, isOnline]
  );

  // Schedule background refresh
  const scheduleBackgroundRefresh = useCallback(() => {
    if (backgroundRefreshTimeoutRef.current) {
      clearTimeout(backgroundRefreshTimeoutRef.current);
    }

    // Refresh every 15 minutes in the background
    backgroundRefreshTimeoutRef.current = setTimeout(
      () => {
        if (isOnline && !isRefreshing) {
          console.log('Background refresh triggered');
          loadData(false); // Background refresh, not forced
        }
      },
      15 * 60 * 1000
    ); // 15 minutes
  }, [loadData, isOnline, isRefreshing]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    console.log('Manual refresh requested');
    loadData(true);
  }, [loadData]);

  // Network status handling
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network back online');
      setIsOnline(true);
      // Automatically refresh when coming back online
      loadData(false);
    };

    const handleOffline = () => {
      console.log('Network went offline');
      setIsOnline(false);
      setError('Offline - showing cached data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Initial load and background refresh scheduling
  useEffect(() => {
    loadData();
    scheduleBackgroundRefresh();

    return () => {
      if (backgroundRefreshTimeoutRef.current) {
        clearTimeout(backgroundRefreshTimeoutRef.current);
      }
    };
  }, [loadData, scheduleBackgroundRefresh]);

  // Reschedule background refresh when data changes
  useEffect(() => {
    scheduleBackgroundRefresh();
  }, [lastFetch, scheduleBackgroundRefresh]);

  return {
    songs,
    setlists,
    loading,
    error,
    isRefreshing,
    isOnline,
    lastFetch,
    refreshData,
  };
}
