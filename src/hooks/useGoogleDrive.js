import { useState, useEffect } from 'react';
import { CONFIG } from '../config';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';

export function useGoogleDrive() {
  const [songs, setSongs] = useState({});
  const [setlists, setSetlists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCachedData = () => {
    try {
      const cached = localStorage.getItem(CONFIG.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        const now = Date.now();
        if (data.timestamp && (now - data.timestamp) < CONFIG.cacheExpiry) {
          return data;
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
    return null;
  };

  const saveCachedData = (data) => {
    try {
      const cacheData = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving cached data:', error);
    }
  };

  const fetchSongsFromDrive = async () => {
    const songs = {};
    console.log('Starting to fetch songs from Google Drive...');
    
    try {
      // Get list of all folders in the songs folder
      const foldersResponse = await fetch(
        `/api/drive/files?q='${CONFIG.songsFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)&key=${CONFIG.apiKey}`
      );

      console.log('Folders response status:', foldersResponse.status);
      
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        console.log('Found folders:', foldersData.files?.length || 0);
        console.log('Folders:', foldersData.files?.map(f => f.name) || []);

        // For each folder, find and fetch the README.md file
        for (const folder of foldersData.files) {
          console.log(`Processing folder: ${folder.name} (ID: ${folder.id})`);
          
          try {
            // Add longer delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
            
            // Find README.md in this folder
            const readmeResponse = await fetch(
              `/api/drive/files?q='${folder.id}'+in+parents+and+name='README.md'&fields=files(id,name)&key=${CONFIG.apiKey}`
            );

            console.log(`README response for ${folder.name}:`, readmeResponse.status);

            if (readmeResponse.ok) {
              const readmeData = await readmeResponse.json();
              console.log(`README files found for ${folder.name}:`, readmeData.files?.length || 0);

              if (readmeData.files.length > 0) {
                const readmeId = readmeData.files[0].id;
                console.log(`Fetching content for README ${readmeId} in ${folder.name}`);

                // Add longer delay before fetching content
                await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds

                // Try API first, then fallback to direct URL
                let content = null;
                try {
                  // Fetch the README.md content via API
                  const contentResponse = await fetch(
                    `/api/drive/files/${readmeId}?alt=media&key=${CONFIG.apiKey}`
                  );

                  console.log(`Content response for ${folder.name}:`, contentResponse.status);

                  if (contentResponse.ok) {
                    content = await contentResponse.text();
                  } else {
                    throw new Error(`API failed with status: ${contentResponse.status}`);
                  }
                } catch (apiError) {
                  console.log(`API failed for ${folder.name}, trying direct URL...`);
                  
                  // Fallback: try direct download URL
                  try {
                    const directUrl = `https://drive.google.com/uc?export=download&id=${readmeId}`;
                    const directResponse = await fetch(directUrl);
                    
                    if (directResponse.ok) {
                      content = await directResponse.text();
                      console.log(`Direct URL succeeded for ${folder.name}`);
                    } else {
                      throw new Error(`Direct URL failed with status: ${directResponse.status}`);
                    }
                  } catch (directError) {
                    console.error(`Both API and direct URL failed for ${folder.name}:`, directError);
                    continue; // Skip this song
                  }
                }

                if (content) {
                  console.log(`Processing song: ${folder.name}`);
                  console.log(`Content length: ${content.length} characters`);

                  try {
                    // Parse frontmatter to get title
                    const { frontmatter } = parseMarkdownWithFrontmatter(content);
                    const title = frontmatter.title || folder.name;
                    console.log(`Song ${folder.name} - Title: ${title}, Has frontmatter: ${Object.keys(frontmatter).length > 0}`);

                    songs[folder.name] = {
                      title: title,
                      content: content
                    };
                    console.log(`Successfully added song: ${folder.name}`);
                  } catch (parseError) {
                    console.error(`Error parsing content for folder ${folder.name}:`, parseError);
                    // Still add the song with folder name as title
                    songs[folder.name] = {
                      title: folder.name,
                      content: content
                    };
                    console.log(`Added song with fallback title: ${folder.name}`);
                  }
                }
              } else {
                console.log(`No README.md found in folder: ${folder.name}`);
              }
            } else {
              console.error(`Failed to fetch README for ${folder.name}:`, readmeResponse.status);
            }
          } catch (folderError) {
            console.error(`Error processing folder ${folder.name}:`, folderError);
          }
        }
      } else {
        console.error('Failed to fetch folders:', foldersResponse.status);
      }
    } catch (error) {
      console.error('API approach failed:', error);
      
      // Check if it's a Google automated query error
      if (error.message && error.message.includes('automated queries')) {
        throw new Error('Google is temporarily blocking requests. Please wait a few minutes and try again.');
      }
      
      throw error;
    }

    console.log('Final songs object:', Object.keys(songs));
    return songs;
  };

  const fetchSetlistsFromDrive = async () => {
    const setlists = {};
    
    try {
      // Get list of all spreadsheet files in the setlists folder
      const filesResponse = await fetch(
        `/api/drive/files?q='${CONFIG.setlistsFolderId}'+in+parents+and+mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'&fields=files(id,name)&key=${CONFIG.apiKey}`
      );

      if (filesResponse.ok) {
        const filesData = await filesResponse.json();

        for (const file of filesData.files) {
          try {
            // Fetch spreadsheet data
            const sheetsResponse = await fetch(
              `/api/sheets/spreadsheets/${file.id}/values/Sheet1!A:A?key=${CONFIG.apiKey}`
            );

            if (sheetsResponse.ok) {
              const sheetsData = await sheetsResponse.json();
              const songTitles = sheetsData.values?.[0] || [];

              setlists[file.name] = {
                name: file.name,
                songs: songTitles
              };
            }
          } catch (fileError) {
            console.log(`Error processing file ${file.name}:`, fileError);
          }
        }
      }
    } catch (error) {
      console.log('Setlists API approach failed:', error);
      throw error;
    }

    return setlists;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    console.log('Starting to load data...');

    try {
      // Try to load cached data first
      const cachedData = loadCachedData();
      if (cachedData) {
        console.log('Using cached data');
        setSongs(cachedData.songs || {});
        setSetlists(cachedData.setlists || {});
      } else {
        console.log('No cached data found');
      }

      // Fetch fresh data
      console.log('Fetching fresh data from Google Drive...');
      const [freshSongs, freshSetlists] = await Promise.all([
        fetchSongsFromDrive(),
        fetchSetlistsFromDrive()
      ]);

      console.log('Fresh songs fetched:', Object.keys(freshSongs).length);
      console.log('Fresh setlists fetched:', Object.keys(freshSetlists).length);

      setSongs(freshSongs);
      setSetlists(freshSetlists);

      // Save to cache
      saveCachedData({
        songs: freshSongs,
        setlists: freshSetlists
      });

      // Show message if no data found
      if (Object.keys(freshSongs).length === 0 && Object.keys(freshSetlists).length === 0) {
        console.log('No data found from Google Drive');
        setError('No data found. Please check your Google Drive API configuration and folder structure.');
      } else {
        console.log('Data loaded successfully');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError(`Failed to load data: ${error.message}`);
      
      // If we have cached data, use it
      const cachedData = loadCachedData();
      if (cachedData) {
        console.log('Using cached data due to error');
        setSongs(cachedData.songs || {});
        setSetlists(cachedData.setlists || {});
      }
    } finally {
      setLoading(false);
      console.log('Data loading completed');
    }
  };

  const refreshData = () => {
    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    songs,
    setlists,
    loading,
    error,
    refreshData
  };
} 