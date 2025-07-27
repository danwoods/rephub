import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';

function SongView({ songs }) {
  const { songId } = useParams();
  const decodedSongId = decodeURIComponent(songId);
  const song = songs[decodedSongId];

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Song not found</h3>
          <p className="mt-1 text-sm text-gray-500">The requested song could not be found.</p>
          <Link to="/songs" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200">
            Back to Songs
          </Link>
        </div>
      </div>
    );
  }

  const { frontmatter, html } = parseMarkdownWithFrontmatter(song.content);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <Link to="/songs" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Songs
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{song.title}</h1>
        
        {(frontmatter.key || frontmatter.tempo) && (
          <div className="flex items-center space-x-6 text-sm text-gray-600 mb-6">
            {frontmatter.key && (
              <span className="flex items-center">
                Key: {frontmatter.key}
              </span>
            )}
            {frontmatter.tempo && (
              <span className="flex items-center">
                Tempo: {frontmatter.tempo} BPM
              </span>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

export default SongView; 