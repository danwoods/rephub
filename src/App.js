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

  const { songs, setlists, loading, error, refreshData } = useGoogleDrive();

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
    <div className="flex h-screen bg-gray-50">
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

        <div className="flex-1">
          <Routes>
            <Route path="/" element={<SongList songs={songs} />} />
            <Route path="/songs" element={<SongList songs={songs} />} />
            <Route path="/songs/:songId" element={<SongView songs={songs} />} />
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

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
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
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}
      </main>
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
