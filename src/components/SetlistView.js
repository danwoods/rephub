import React from 'react';
import { useParams, Link } from 'react-router-dom';

function SetlistView({ setlists, songs, onPerformanceMode }) {
  const { setlistId } = useParams();
  const decodedSetlistId = decodeURIComponent(setlistId);
  const setlist = setlists[decodedSetlistId];

  // One-time debug log when setlist is loaded
  React.useEffect(() => {
    if (setlist) {
      console.log(
        `Setlist "${setlist.name}" loaded with ${setlist.songs.length} songs:`,
        setlist.songs
      );
    }
  }, [setlist]);

  if (!setlist) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Setlist not found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            The requested setlist could not be found.
          </p>
          <Link
            to="/setlists"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
          >
            Back to Setlists
          </Link>
        </div>
      </div>
    );
  }

  // Find matching songs from the setlist
  const setlistSongs = setlist.songs
    .map((songTitle) => {
      // Find song by title (case-insensitive)
      const songEntry = Object.entries(songs).find(
        ([id, song]) => song.title.toLowerCase() === songTitle.toLowerCase()
      );

      // Debug logging
      if (!songEntry) {
        console.warn(`❌ Song not found: "${songTitle}"`);
        console.log(
          'Available songs:',
          Object.keys(songs).map((id) => songs[id].title)
        );
      } else {
        console.log(`✅ Found song: "${songTitle}" -> "${songEntry[1].title}"`);
      }

      return songEntry ? { id: songEntry[0], ...songEntry[1] } : null;
    })
    .filter(Boolean);

  console.log(
    `📊 Setlist "${setlist.name}": ${setlist.songs.length} total songs, ${setlistSongs.length} matched songs`
  );

  const handlePerformanceMode = () => {
    onPerformanceMode(setlistSongs);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <Link
          to="/setlists"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Setlists
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {setlist.name}
            </h1>
            <p className="text-gray-600">{setlistSongs.length} songs</p>
          </div>

          <button
            onClick={handlePerformanceMode}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 flex items-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Performance Mode
          </button>
        </div>

        <div className="space-y-4">
          {setlistSongs.length > 0 ? (
            setlistSongs.map((song, index) => (
              <Link
                key={song.id}
                to={`/songs/${encodeURIComponent(song.id)}`}
                className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-lg font-mono text-gray-400 mr-4 w-8 text-center">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {song.title}
                      </h3>
                      <p className="text-sm text-gray-600">{song.id}</p>
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No matching songs found in this setlist.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetlistView;
