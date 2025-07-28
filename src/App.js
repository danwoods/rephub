import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SongList from './components/SongList';
import SongView from './components/SongView';
import SetlistList from './components/SetlistList';
import SetlistView from './components/SetlistView';
import PerformanceMode from './components/PerformanceMode';
import { useGoogleDrive } from './hooks/useGoogleDrive';

function AppContent() {
  const location = useLocation();
  const [currentView, setCurrentView] = useState('songs');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [performanceSongs, setPerformanceSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    songs,
    setlists,
    loading,
    error,
    isRefreshing,
    isOnline,
    lastFetch,
    refreshData,
  } = useGoogleDrive();

  const formatLastFetch = (timestamp) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  useEffect(() => {
    // Update current view based on route
    if (location.pathname.startsWith('/songs')) {
      setCurrentView('songs');
    } else if (location.pathname.startsWith('/setlists')) {
      setCurrentView('setlists');
    }
  }, [location]);

  // Close sidebar when route changes (mobile behavior)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const handlePerformanceMode = (setlistSongs) => {
    setPerformanceSongs(setlistSongs);
    setCurrentSongIndex(0);
    setPerformanceMode(true);
  };

  const exitPerformanceMode = useCallback(() => {
    setPerformanceMode(false);
    setPerformanceSongs([]);
    setCurrentSongIndex(0);
  }, []);

  const nextSong = useCallback(() => {
    if (currentSongIndex < performanceSongs.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1);
    }
  }, [currentSongIndex, performanceSongs.length]);

  const previousSong = useCallback(() => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1);
    }
  }, [currentSongIndex]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Handle keyboard navigation in performance mode
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!performanceMode) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          nextSong();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousSong();
          break;
        case 'Escape':
          e.preventDefault();
          exitPerformanceMode();
          break;
        default:
          break;
      }
    };

    if (performanceMode) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [performanceMode, nextSong, previousSong, exitPerformanceMode]);

  if (performanceMode) {
    return (
      <PerformanceMode
        songs={performanceSongs}
        currentIndex={currentSongIndex}
        onNext={nextSong}
        onPrevious={previousSong}
        onExit={exitPerformanceMode}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Enhanced status bar - spans full width */}
      <div className="status-bar bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div
            className={`flex items-center space-x-1 ${isOnline ? 'text-green-600' : 'text-red-600'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
            ></span>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          {lastFetch && (
            <div className="text-gray-600">
              Last updated: {formatLastFetch(lastFetch)}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isRefreshing && (
            <div className="flex items-center space-x-1 text-blue-600">
              <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
              <span>Refreshing...</span>
            </div>
          )}
          <button
            onClick={refreshData}
            className="px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
            disabled={isRefreshing}
            title="Refresh data from Google Drive"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Enhanced error banner */}
      {error && (
        <div
          className={`border-l-4 p-3 text-sm ${
            isOnline
              ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
              : 'bg-blue-100 border-blue-500 text-blue-700'
          }`}
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className={`h-4 w-4 mt-0.5 ${isOnline ? 'text-yellow-400' : 'text-blue-400'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={closeSidebar}
            data-testid="backdrop"
          />
        )}

        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onRefresh={refreshData}
          onPerformanceMode={() => setPerformanceMode(true)}
          loading={loading}
          isOpen={sidebarOpen}
          onClose={closeSidebar}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile header with hamburger menu */}
          <div
            className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between"
            data-testid="mobile-header"
          >
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">RepHub</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<SongList songs={songs} />} />
              <Route path="/songs" element={<SongList songs={songs} />} />
              <Route
                path="/songs/:songId"
                element={<SongView songs={songs} />}
              />
              <Route
                path="/setlists"
                element={<SetlistList setlists={setlists} />}
              />
              <Route
                path="/setlists/:setlistId"
                element={
                  <SetlistView
                    setlists={setlists}
                    songs={songs}
                    onPerformanceMode={handlePerformanceMode}
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
