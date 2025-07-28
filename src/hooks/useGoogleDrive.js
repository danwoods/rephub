import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../config';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';

// Utility function to format folder name into a proper title
const formatFolderNameToTitle = (folderName) => {
  // Convert snake_case to Title Case
  return folderName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
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
        if (data.timestamp && now - data.timestamp < CONFIG.cacheExpiry) {
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
        timestamp: Date.now(),
      };
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving cached data:', error);
    }
  };

  // Fallback method for individual song fetching
  const fetchSongsIndividually = useCallback(async (folders) => {
    const songs = {};
    console.log('Fetching songs individually...');

    for (const folder of folders) {
      console.log(`Processing folder: ${folder.name} (ID: ${folder.id})`);

      try {
        // Find README.md in this folder
        const readmeResponse = await fetch(
          `/api/drive/files?q='${folder.id}'+in+parents+and+name='README.md'&fields=files(id,name)`
        );

        console.log(
          `README response for ${folder.name}:`,
          readmeResponse.status
        );

        if (readmeResponse.ok) {
          const readmeData = await readmeResponse.json();
          console.log(
            `README files found for ${folder.name}:`,
            readmeData.files?.length || 0
          );

          if (readmeData.files.length > 0) {
            const readmeId = readmeData.files[0].id;
            console.log(
              `Fetching content for README ${readmeId} in ${folder.name}`
            );

            // Fetch the README.md content
            const contentResponse = await fetch(
              `/api/drive/files/${readmeId}?alt=media`
            );

            console.log(
              `Content response for ${folder.name}:`,
              contentResponse.status
            );

            if (contentResponse.ok) {
              const content = await contentResponse.text();
              console.log(`Processing song: ${folder.name}`);
              console.log(`Content length: ${content.length} characters`);

              try {
                // Parse frontmatter to get title
                const { frontmatter } = parseMarkdownWithFrontmatter(content);
                const title =
                  frontmatter.title || formatFolderNameToTitle(folder.name);
                console.log(
                  `Song ${folder.name} - Title: ${title}, Has frontmatter: ${Object.keys(frontmatter).length > 0}`
                );

                songs[folder.name] = {
                  title: title,
                  content: content,
                };
                console.log(`Successfully added song: ${folder.name}`);
              } catch (parseError) {
                console.error(
                  `Error parsing content for folder ${folder.name}:`,
                  parseError
                );
                // Still add the song with formatted folder name as title
                songs[folder.name] = {
                  title: formatFolderNameToTitle(folder.name),
                  content: content,
                };
                console.log(
                  `Added song with fallback title: ${formatFolderNameToTitle(folder.name)}`
                );
              }
            } else {
              console.error(
                `Failed to fetch content for ${folder.name}:`,
                contentResponse.status
              );
            }
          } else {
            console.log(`No README.md found in folder: ${folder.name}`);
          }
        } else {
          console.error(
            `Failed to fetch README for ${folder.name}:`,
            readmeResponse.status
          );
        }
      } catch (folderError) {
        console.error(`Error processing folder ${folder.name}:`, folderError);
      }
    }

    return songs;
  }, []);

  const fetchSongsFromDrive = useCallback(async () => {
    const songs = {};
    console.log('Starting to fetch songs from Google Drive...');

    try {
      // Get list of all folders in the songs folder
      const foldersResponse = await fetch(
        `/api/drive/files?q='${CONFIG.songsFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`
      );

      console.log('Folders response status:', foldersResponse.status);

      if (!foldersResponse.ok) {
        const errorText = await foldersResponse.text();
        console.error('Folders API error:', errorText);

        // Check if we got HTML instead of JSON (common Vercel deployment issue)
        if (
          errorText.includes('<!doctype html>') ||
          errorText.includes('<html>')
        ) {
          throw new Error(`API endpoint returned HTML instead of JSON. This usually means:
1. GOOGLE_API_KEY environment variable is not set in Vercel
2. API routes aren't deployed properly
3. There's a routing issue in vercel.json

Status: ${foldersResponse.status}`);
        }

        throw new Error(
          `Failed to fetch songs folders (${foldersResponse.status}): ${errorText}`
        );
      }

      const foldersData = await foldersResponse.json();
      console.log('Found folders:', foldersData.files?.length || 0);
      console.log('Folders:', foldersData.files?.map((f) => f.name) || []);

      if (foldersData.files && foldersData.files.length > 0) {
        // Use batch API to fetch all songs at once
        const folderIds = foldersData.files.map((f) => f.id).join(',');
        console.log(
          `Using batch API to fetch ${foldersData.files.length} songs`
        );

        const batchResponse = await fetch(
          `/api/drive/batch-songs?folderIds=${folderIds}`
        );

        console.log('Batch response status:', batchResponse.status);

        if (batchResponse.ok) {
          const batchData = await batchResponse.json();
          console.log(
            'Batch data received:',
            Object.keys(batchData.songs || {})
          );

          // Process each song from the batch response
          for (const [folderName, songData] of Object.entries(
            batchData.songs || {}
          )) {
            try {
              console.log(`Processing song: ${folderName}`);
              console.log(
                `Content length: ${songData.content.length} characters`
              );

              // Parse frontmatter to get title
              const { frontmatter } = parseMarkdownWithFrontmatter(
                songData.content
              );
              const title =
                frontmatter.title || formatFolderNameToTitle(folderName);
              console.log(
                `Song ${folderName} - Title: ${title}, Has frontmatter: ${Object.keys(frontmatter).length > 0}`
              );

              songs[folderName] = {
                title: title,
                content: songData.content,
              };
              console.log(`Successfully added song: ${folderName}`);
            } catch (parseError) {
              console.error(
                `Error parsing content for folder ${folderName}:`,
                parseError
              );
              // Still add the song with formatted folder name as title
              songs[folderName] = {
                title: formatFolderNameToTitle(folderName),
                content: songData.content,
              };
              console.log(
                `Added song with fallback title: ${formatFolderNameToTitle(folderName)}`
              );
            }
          }
        } else {
          const errorText = await batchResponse.text();
          console.error('Batch songs API error:', errorText);

          // Check if we got HTML instead of JSON
          if (
            errorText.includes('<!doctype html>') ||
            errorText.includes('<html>')
          ) {
            throw new Error(
              `Batch API returned HTML instead of JSON. Check environment configuration.`
            );
          }

          console.log('Falling back to individual requests...');
          return await fetchSongsIndividually(foldersData.files);
        }
      }
    } catch (error) {
      console.error('Songs API approach failed:', error);
      throw error;
    }

    console.log('Final songs object:', Object.keys(songs));
    return songs;
  }, [fetchSongsIndividually]);

  const fetchSetlistsFromDrive = async () => {
    const setlists = {};
    console.log('Starting to fetch setlists from Google Drive...');

    try {
      // Get list of all Google Sheets files in the setlists folder
      const filesResponse = await fetch(
        `/api/drive/files?q='${CONFIG.setlistsFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,mimeType)`
      );

      console.log('Setlists response status:', filesResponse.status);

      if (!filesResponse.ok) {
        const errorText = await filesResponse.text();
        console.error('Setlists API error:', errorText);

        // Check if we got HTML instead of JSON
        if (
          errorText.includes('<!doctype html>') ||
          errorText.includes('<html>')
        ) {
          throw new Error(
            `Setlists API returned HTML instead of JSON. Check environment configuration.`
          );
        }

        throw new Error(
          `Failed to fetch setlists (${filesResponse.status}): ${errorText}`
        );
      }

      const filesData = await filesResponse.json();
      console.log('Found setlist files:', filesData.files?.length || 0);
      console.log('Setlist files:', filesData.files?.map((f) => f.name) || []);

      for (const file of filesData.files) {
        try {
          console.log(
            `Processing setlist file: ${file.name} (ID: ${file.id}, MIME: ${file.mimeType})`
          );

          // First, get the spreadsheet metadata to find actual sheet names
          let sheetNames = ['Sheet1', 'Sheet 1']; // fallback names
          try {
            const metadataResponse = await fetch(
              `/api/sheets/metadata?spreadsheetId=${file.id}`
            );

            if (!metadataResponse.ok) {
              const metadataError = await metadataResponse.text();
              console.error(
                `Cannot access spreadsheet ${file.name}:`,
                metadataError
              );
              continue; // Skip this spreadsheet
            }

            const metadataText = await metadataResponse.text();
            let metadata;
            try {
              metadata = JSON.parse(metadataText);
              console.log(`Spreadsheet ${file.name} is accessible`);

              // Extract actual sheet names from metadata
              if (metadata.sheets && Array.isArray(metadata.sheets)) {
                const actualSheetNames = metadata.sheets
                  .map((sheet) => sheet.properties?.title)
                  .filter((name) => name);
                if (actualSheetNames.length > 0) {
                  sheetNames = actualSheetNames;
                  console.log(
                    `Found sheet names for ${file.name}:`,
                    sheetNames
                  );
                } else {
                  console.log(
                    `No sheet names found in metadata for ${file.name}, using fallback names`
                  );
                }
              }
            } catch (parseError) {
              console.error(
                `Error parsing metadata for ${file.name}:`,
                parseError
              );
              console.error(
                `Metadata response content (first 200 chars):`,
                metadataText.substring(0, 200) + '...'
              );

              // Check if it's an HTML error page from Google
              if (
                metadataText.includes('<!doctype html>') ||
                metadataText.includes('<html>')
              ) {
                console.error(
                  'Metadata request returned HTML instead of JSON - likely a Google API error or rate limiting'
                );
                console.log(`Skipping ${file.name} due to metadata API error`);
                continue; // Skip this spreadsheet
              }

              // If not HTML, use fallback sheet names and continue
              console.log(
                `Using fallback sheet names for ${file.name} due to metadata parsing error`
              );
            }
          } catch (metadataError) {
            console.error(
              `Error getting metadata for ${file.name}:`,
              metadataError
            );
            continue; // Skip this spreadsheet
          }

          for (const sheetName of sheetNames) {
            try {
              const sheetsResponse = await fetch(
                `/api/sheets/values?spreadsheetId=${file.id}&range=${encodeURIComponent(sheetName)}`
              );

              console.log(
                `Sheets response for ${file.name} (${sheetName}):`,
                sheetsResponse.status
              );

              if (sheetsResponse.ok) {
                // Check if response is JSON before parsing
                const responseText = await sheetsResponse.text();
                let sheetsData;

                try {
                  sheetsData = JSON.parse(responseText);
                } catch (parseError) {
                  console.error(
                    `Invalid JSON response for ${file.name} (${sheetName}):`,
                    responseText.substring(0, 200) + '...'
                  );

                  // Check if it's an HTML error page from Google
                  if (
                    responseText.includes('<!doctype html>') ||
                    responseText.includes('<html>')
                  ) {
                    console.error(
                      'Received HTML instead of JSON - likely a Google API error or rate limiting'
                    );
                    throw new Error(
                      'Google Sheets API returned HTML error page - possible rate limiting or API key issue'
                    );
                  }

                  throw new Error(
                    `Invalid JSON response: ${parseError.message}`
                  );
                }

                console.log(`Sheets data for ${file.name}:`, sheetsData);

                // Extract song titles from all rows in the first column
                const songTitles =
                  sheetsData.values
                    ?.map((row) => row[0])
                    .filter((title) => title && title.trim()) || [];
                console.log(`Song titles for ${file.name}:`, songTitles);

                setlists[file.name] = {
                  name: file.name,
                  songs: songTitles,
                };
                console.log(`Successfully added setlist: ${file.name}`);
                break; // Found the sheet, no need to try other names
              } else {
                const errorText = await sheetsResponse.text();
                console.log(
                  `Failed to fetch sheet ${sheetName} for ${file.name} (${sheetsResponse.status}):`,
                  errorText
                );

                // Try to parse error as JSON for better error messages
                let parsedError;
                try {
                  parsedError = JSON.parse(errorText);
                  if (parsedError.error) {
                    console.error(
                      `API Error for ${file.name}: ${parsedError.error}`
                    );
                    if (sheetsResponse.status === 429) {
                      console.log(
                        'Rate limiting detected, will try other sheet names'
                      );
                    } else if (sheetsResponse.status === 404) {
                      console.log(
                        `Sheet ${sheetName} not found, will try other sheet names`
                      );
                    }
                  }
                } catch (e) {
                  console.log(
                    'Could not parse error response as JSON:',
                    errorText.substring(0, 100)
                  );
                }
              }
            } catch (sheetError) {
              console.log(
                `Failed to fetch sheet ${sheetName} for ${file.name}:`,
                sheetError
              );
              continue; // Try next sheet name
            }
          }
        } catch (fileError) {
          console.error(
            `Error processing setlist file ${file.name}:`,
            fileError
          );
        }
      }
    } catch (error) {
      console.error('Setlists API approach failed:', error);
      throw error;
    }

    console.log('Final setlists object:', Object.keys(setlists));
    return setlists;
  };

  const loadData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      console.log('Starting to load data...');

      try {
        // Try to load cached data first
        const cachedData = loadCachedData();
        if (cachedData && !forceRefresh) {
          console.log('Using valid cached data - skipping API calls');
          setSongs(cachedData.songs || {});
          setSetlists(cachedData.setlists || {});
          setLoading(false);
          return;
        } else {
          console.log(
            'No valid cached data found or refresh forced - fetching from API'
          );
          // Show cached data immediately while fetching fresh data
          if (cachedData) {
            console.log(
              'Showing expired cached data while fetching fresh data'
            );
            setSongs(cachedData.songs || {});
            setSetlists(cachedData.setlists || {});
          }
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
        console.log(
          'Fresh setlists fetched:',
          Object.keys(freshSetlists).length
        );

        setSongs(freshSongs);
        setSetlists(freshSetlists);

        // Save to cache
        saveCachedData({
          songs: freshSongs,
          setlists: freshSetlists,
        });

        // Show message if no data found
        if (
          Object.keys(freshSongs).length === 0 &&
          Object.keys(freshSetlists).length === 0
        ) {
          console.log('No data found from Google Drive');
          setError(
            'No data found. Please check your Google Drive API configuration and folder structure.'
          );
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
    },
    [fetchSongsFromDrive]
  );

  const refreshData = useCallback(() => {
    loadData(true); // Force refresh when explicitly requested
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    songs,
    setlists,
    loading,
    error,
    refreshData,
  };
}
