import React from 'react';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';

function PerformanceMode({ songs, currentIndex, onNext, onPrevious, onExit }) {
  if (songs.length === 0) {
    return (
      <div className="performance-mode">
        <div className="performance-content">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No songs in setlist</h2>
            <button
              onClick={onExit}
              className="performance-btn"
            >
              Exit Performance Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSong = songs[currentIndex];
  const { frontmatter, html } = parseMarkdownWithFrontmatter(currentSong.content);

  return (
    <div className="performance-mode">
      <div className="performance-content">
        <div className="max-w-4xl mx-auto">
          {/* Song title and metadata */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
              {currentSong.title}
            </h1>
            {(frontmatter.key || frontmatter.tempo) && (
              <div className="flex justify-center space-x-8 text-lg text-gray-300">
                {frontmatter.key && (
                  <span>Key: {frontmatter.key}</span>
                )}
                {frontmatter.tempo && (
                  <span>Tempo: {frontmatter.tempo} BPM</span>
                )}
              </div>
            )}
          </div>

          {/* Song content */}
          <div 
            className="text-xl md:text-2xl leading-relaxed text-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Song counter */}
          <div className="mt-8 text-center text-gray-400">
            {currentIndex + 1} of {songs.length}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="performance-nav">
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="performance-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onExit}
          className="performance-btn"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex === songs.length - 1}
          className="performance-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute top-4 right-4 text-gray-400 text-sm">
        <div className="text-center">
          <div>← → Navigate</div>
          <div>Space Next</div>
          <div>Esc Exit</div>
        </div>
      </div>
    </div>
  );
}

export default PerformanceMode; 