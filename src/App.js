import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SongList from './components/SongList';
import SongView from './components/SongView';
import SetlistList from './components/SetlistList';
import SetlistView from './components/SetlistView';
import PerformanceMode from './components/PerformanceMode';
import { useGoogleDrive } from './hooks/useGoogleDrive';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentView, setCurrentView] = useState('songs');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [performanceSongs, setPerformanceSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

  const { songs, setlists, loading, error, refreshData } = useGoogleDrive();

  useEffect(() => {
    // Update current view based on route
    if (location.pathname.startsWith('/songs')) {
      setCurrentView('songs');
    } else if (location.pathname.startsWith('/setlists')) {
      setCurrentView('setlists');
    }
  }, [location]);

  const handlePerformanceMode = (setlistSongs) => {
    setPerformanceSongs(setlistSongs);
    setCurrentSongIndex(0);
    setPerformanceMode(true);
  };

  const exitPerformanceMode = () => {
    setPerformanceMode(false);
    setPerformanceSongs([]);
    setCurrentSongIndex(0);
  };

  const nextSong = () => {
    if (currentSongIndex < performanceSongs.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1);
    }
  };

  const previousSong = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1);
    }
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
  }, [performanceMode, currentSongIndex, performanceSongs.length]);

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
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onRefresh={refreshData}
        onPerformanceMode={() => setPerformanceMode(true)}
        loading={loading}
      />
      
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<SongList songs={songs} />} />
            <Route path="/songs" element={<SongList songs={songs} />} />
            <Route path="/songs/:songId" element={<SongView songs={songs} />} />
            <Route path="/setlists" element={<SetlistList setlists={setlists} />} />
            <Route path="/setlists/:setlistId" element={<SetlistView setlists={setlists} songs={songs} onPerformanceMode={handlePerformanceMode} />} />
          </Routes>
        </div>
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
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