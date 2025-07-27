import { useState, useEffect } from 'react';
import { CONFIG } from '../config';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';

// Utility function to format folder name into a proper title
const formatFolderNameToTitle = (folderName) => {
  // Convert snake_case to Title Case
  return folderName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

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
        `/api/drive/files?q='${CONFIG.songsFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`
      );

      console.log('Folders response status:', foldersResponse.status);
      
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        console.log('Found folders:', foldersData.files?.length || 0);
        console.log('Folders:', foldersData.files?.map(f => f.name) || []);

        if (foldersData.files && foldersData.files.length > 0) {
          // Use batch API to fetch all songs at once
          const folderIds = foldersData.files.map(f => f.id).join(',');
          console.log(`Using batch API to fetch ${foldersData.files.length} songs`);
          
          const batchResponse = await fetch(
            `/api/drive/batch-songs?folderIds=${folderIds}`
          );

          console.log('Batch response status:', batchResponse.status);

          if (batchResponse.ok) {
            const batchData = await batchResponse.json();
            console.log('Batch data received:', Object.keys(batchData.songs || {}));

            // Process each song from the batch response
            for (const [folderName, songData] of Object.entries(batchData.songs || {})) {
              try {
                console.log(`Processing song: ${folderName}`);
                console.log(`Content length: ${songData.content.length} characters`);

                // Parse frontmatter to get title
                const { frontmatter } = parseMarkdownWithFrontmatter(songData.content);
                const title = frontmatter.title || formatFolderNameToTitle(folderName);
                console.log(`Song ${folderName} - Title: ${title}, Has frontmatter: ${Object.keys(frontmatter).length > 0}`);

                songs[folderName] = {
                  title: title,
                  content: songData.content
                };
                console.log(`Successfully added song: ${folderName}`);
              } catch (parseError) {
                console.error(`Error parsing content for folder ${folderName}:`, parseError);
                // Still add the song with formatted folder name as title
                songs[folderName] = {
                  title: formatFolderNameToTitle(folderName),
                  content: songData.content
                };
                console.log(`Added song with fallback title: ${formatFolderNameToTitle(folderName)}`);
              }
            }
          } else {
            console.error('Failed to fetch batch songs:', batchResponse.status);
            // Fallback to individual requests if batch fails
            console.log('Falling back to individual requests...');
            return await fetchSongsIndividually(foldersData.files);
          }
        }
      } else {
        console.error('Failed to fetch folders:', foldersResponse.status);
      }
    } catch (error) {
      console.error('API approach failed:', error);
      throw error;
    }

    console.log('Final songs object:', Object.keys(songs));
    return songs;
  };

  // Fallback method for individual song fetching
  const fetchSongsIndividually = async (folders) => {
    const songs = {};
    console.log('Fetching songs individually...');
    
    for (const folder of folders) {
      console.log(`Processing folder: ${folder.name} (ID: ${folder.id})`);
      
      try {
        // Find README.md in this folder
        const readmeResponse = await fetch(
          `/api/drive/files?q='${folder.id}'+in+parents+and+name='README.md'&fields=files(id,name)`
        );

        console.log(`README response for ${folder.name}:`, readmeResponse.status);

        if (readmeResponse.ok) {
          const readmeData = await readmeResponse.json();
          console.log(`README files found for ${folder.name}:`, readmeData.files?.length || 0);

          if (readmeData.files.length > 0) {
            const readmeId = readmeData.files[0].id;
            console.log(`Fetching content for README ${readmeId} in ${folder.name}`);

            // Fetch the README.md content
            const contentResponse = await fetch(
              `/api/drive/files/${readmeId}?alt=media`
            );

            console.log(`Content response for ${folder.name}:`, contentResponse.status);

            if (contentResponse.ok) {
              const content = await contentResponse.text();
              console.log(`Processing song: ${folder.name}`);
              console.log(`Content length: ${content.length} characters`);

              try {
                // Parse frontmatter to get title
                const { frontmatter } = parseMarkdownWithFrontmatter(content);
                const title = frontmatter.title || formatFolderNameToTitle(folder.name);
                console.log(`Song ${folder.name} - Title: ${title}, Has frontmatter: ${Object.keys(frontmatter).length > 0}`);

                songs[folder.name] = {
                  title: title,
                  content: content
                };
                console.log(`Successfully added song: ${folder.name}`);
              } catch (parseError) {
                console.error(`Error parsing content for folder ${folder.name}:`, parseError);
                // Still add the song with formatted folder name as title
                songs[folder.name] = {
                  title: formatFolderNameToTitle(folder.name),
                  content: content
                };
                console.log(`Added song with fallback title: ${formatFolderNameToTitle(folder.name)}`);
              }
            } else {
              console.error(`Failed to fetch content for ${folder.name}:`, contentResponse.status);
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
    
    return songs;
  };

  const fetchSetlistsFromDrive = async () => {
    const setlists = {};
    console.log('Starting to fetch setlists from Google Drive...');
    
    try {
      // Get list of all Google Sheets files in the setlists folder
      const filesResponse = await fetch(
        `/api/drive/files?q='${CONFIG.setlistsFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,mimeType)`
      );

      console.log('Setlists response status:', filesResponse.status);
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        console.log('Found setlist files:', filesData.files?.length || 0);
        console.log('Setlist files:', filesData.files?.map(f => f.name) || []);

        for (const file of filesData.files) {
          try {
            console.log(`Processing setlist file: ${file.name} (ID: ${file.id}, MIME: ${file.mimeType})`);
            
            // Fetch spreadsheet data - try different sheet names
            const sheetNames = ['Sheet1', 'Sheet 1', 'A1', 'Sheet1!A:A'];
            
            for (const sheetName of sheetNames) {
              try {
                            const sheetsResponse = await fetch(
              `/api/sheets/spreadsheets/${file.id}/values/${sheetName}`
            );

                console.log(`Sheets response for ${file.name} (${sheetName}):`, sheetsResponse.status);

                if (sheetsResponse.ok) {
                  const sheetsData = await sheetsResponse.json();
                  console.log(`Sheets data for ${file.name}:`, sheetsData);
                  
                  // Extract song titles from all rows in the first column
                  const songTitles = sheetsData.values?.map(row => row[0]).filter(title => title && title.trim()) || [];
                  console.log(`Song titles for ${file.name}:`, songTitles);

                  setlists[file.name] = {
                    name: file.name,
                    songs: songTitles
                  };
                  console.log(`Successfully added setlist: ${file.name}`);
                  break; // Found the sheet, no need to try other names
                }
              } catch (sheetError) {
                console.log(`Failed to fetch sheet ${sheetName} for ${file.name}:`, sheetError);
                continue; // Try next sheet name
              }
            }
          } catch (fileError) {
            console.error(`Error processing setlist file ${file.name}:`, fileError);
          }
        }
      } else {
        console.error('Failed to fetch setlist files:', filesResponse.status);
      }
    } catch (error) {
      console.error('Setlists API approach failed:', error);
      throw error;
    }

    console.log('Final setlists object:', Object.keys(setlists));
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
      
      console.log('About to call fetchSongsFromDrive...');
      const freshSongs = await fetchSongsFromDrive();
      console.log('Songs fetched, about to call fetchSetlistsFromDrive...');
      
      let freshSetlists = {};
      try {
        freshSetlists = await fetchSetlistsFromDrive();
      } catch (setlistError) {
        console.error('Error fetching setlists:', setlistError);
        freshSetlists = {};
      }

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