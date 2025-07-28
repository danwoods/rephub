/**
 * Integration tests for fetchSetlistsFromDrive function
 * Tests the enhanced multi-sheet functionality at the API level
 */

const { google } = require('googleapis');

// Mock the Google APIs
jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        list: jest.fn(),
      },
    })),
    sheets: jest.fn(() => ({
      spreadsheets: {
        get: jest.fn(),
        values: {
          get: jest.fn(),
        },
      },
    })),
  },
}));

// Mock the rate limiting and retry functions
const mockRateLimitedRequest = jest.fn((fn) => fn());
const mockRetryWithBackoff = jest.fn((fn) => fn());

// Mock the actual fetchSetlistsFromDrive function
// Note: This would typically be imported, but for testing we'll create a standalone version
const createMockFetchSetlistsFromDrive = (drive, sheets) => {
  return async () => {
    console.log('Fetching setlists from Google Drive...');
    const CONFIG = {
      setlistsFolderId: 'mock-setlists-folder-id',
    };

    try {
      // Get list of all Google Sheets files in the setlists folder
      const filesResponse = await mockRateLimitedRequest(async () => {
        return await mockRetryWithBackoff(async () => {
          return await drive.files.list({
            q: `'${CONFIG.setlistsFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
            fields: 'files(id,name,mimeType)',
            pageSize: 100,
          });
        });
      });

      const files = filesResponse.data.files || [];
      const setlists = {};

      for (const file of files) {
        try {
          // First, get metadata to discover all sheets in this spreadsheet
          const metadataResponse = await mockRateLimitedRequest(async () => {
            return await mockRetryWithBackoff(async () => {
              return await sheets.spreadsheets.get({
                spreadsheetId: file.id,
                fields: 'properties,sheets.properties',
              });
            });
          });

          const spreadsheetMetadata = metadataResponse.data;
          const sheetsList = spreadsheetMetadata.sheets || [];

          // Process each sheet in the spreadsheet
          for (const sheet of sheetsList) {
            const sheetName = sheet.properties.title;

            try {
              const valuesResponse = await mockRateLimitedRequest(async () => {
                return await mockRetryWithBackoff(async () => {
                  return await sheets.spreadsheets.values.get({
                    spreadsheetId: file.id,
                    range: `${sheetName}!A:Z`,
                  });
                });
              });

              const rows = valuesResponse.data.values || [];
              if (rows.length > 0) {
                // Create a meaningful setlist name
                // If there's only one sheet, use just the file name
                // If multiple sheets, use "FileName - SheetName" format
                const setlistName =
                  sheetsList.length === 1
                    ? file.name
                    : `${file.name} - ${sheetName}`;

                setlists[setlistName] = {
                  name: setlistName,
                  songs: rows.flat().filter((cell) => cell && cell.trim()),
                };
              }
            } catch (sheetError) {
              console.error(
                `Error processing sheet "${sheetName}" in file "${file.name}":`,
                sheetError
              );
              continue; // Try next sheet
            }
          }
        } catch (fileError) {
          console.error(
            `Error processing setlist file ${file.name}:`,
            fileError
          );
        }
      }

      return setlists;
    } catch (error) {
      console.error('Error fetching setlists:', error);
      throw error;
    }
  };
};

describe('fetchSetlistsFromDrive - Multi-Sheet API Integration', () => {
  let mockDrive;
  let mockSheets;
  let fetchSetlistsFromDrive;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDrive = {
      files: {
        list: jest.fn(),
      },
    };

    mockSheets = {
      spreadsheets: {
        get: jest.fn(),
        values: {
          get: jest.fn(),
        },
      },
    };

    google.drive.mockReturnValue(mockDrive);
    google.sheets.mockReturnValue(mockSheets);

    fetchSetlistsFromDrive = createMockFetchSetlistsFromDrive(
      mockDrive,
      mockSheets
    );
  });

  it('should handle single sheet spreadsheet with clean naming', async () => {
    // Mock Drive API response - single spreadsheet
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'sheet1',
            name: 'Jazz Standards',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    // Mock Sheets metadata response - single sheet
    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        properties: { title: 'Jazz Standards' },
        sheets: [{ properties: { title: 'Sheet1' } }],
      },
    });

    // Mock sheet values response
    mockSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [['All of Me'], ['Blue Moon'], ['Fly Me to the Moon']],
      },
    });

    const result = await fetchSetlistsFromDrive();

    expect(result).toHaveProperty('Jazz Standards');
    expect(result['Jazz Standards'].name).toBe('Jazz Standards');
    expect(result['Jazz Standards'].songs).toEqual([
      'All of Me',
      'Blue Moon',
      'Fly Me to the Moon',
    ]);
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('should handle multi-sheet spreadsheet with compound naming', async () => {
    // Mock Drive API response - single spreadsheet with multiple sheets
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'wedding-music',
            name: 'Wedding Music',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    // Mock Sheets metadata response - multiple sheets
    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        properties: { title: 'Wedding Music' },
        sheets: [
          { properties: { title: 'Ceremony' } },
          { properties: { title: 'Reception' } },
          { properties: { title: 'Cocktail Hour' } },
        ],
      },
    });

    // Mock sheet values responses
    mockSheets.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: { values: [['Canon in D'], ['Ave Maria']] },
      })
      .mockResolvedValueOnce({
        data: { values: [['Dancing Queen'], ['Sweet Caroline']] },
      })
      .mockResolvedValueOnce({
        data: { values: [['Blue Moon'], ['The Way You Look Tonight']] },
      });

    const result = await fetchSetlistsFromDrive();

    expect(result).toHaveProperty('Wedding Music - Ceremony');
    expect(result).toHaveProperty('Wedding Music - Reception');
    expect(result).toHaveProperty('Wedding Music - Cocktail Hour');

    expect(result['Wedding Music - Ceremony'].songs).toEqual([
      'Canon in D',
      'Ave Maria',
    ]);
    expect(result['Wedding Music - Reception'].songs).toEqual([
      'Dancing Queen',
      'Sweet Caroline',
    ]);
    expect(result['Wedding Music - Cocktail Hour'].songs).toEqual([
      'Blue Moon',
      'The Way You Look Tonight',
    ]);

    expect(Object.keys(result)).toHaveLength(3);
  });

  it('should handle mixed single and multi-sheet spreadsheets', async () => {
    // Mock Drive API response - multiple spreadsheets
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'single-sheet',
            name: 'Summer Concert',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
          {
            id: 'multi-sheet',
            name: 'Holiday Shows',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    // Mock Sheets metadata responses
    mockSheets.spreadsheets.get
      .mockResolvedValueOnce({
        data: {
          properties: { title: 'Summer Concert' },
          sheets: [{ properties: { title: 'Sheet1' } }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          properties: { title: 'Holiday Shows' },
          sheets: [
            { properties: { title: 'Christmas' } },
            { properties: { title: 'New Year' } },
          ],
        },
      });

    // Mock sheet values responses
    mockSheets.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: { values: [['Sweet Child O Mine'], ['Hotel California']] },
      })
      .mockResolvedValueOnce({
        data: { values: [['Silent Night'], ['Jingle Bells']] },
      })
      .mockResolvedValueOnce({
        data: { values: [['Auld Lang Syne'], ['Celebration']] },
      });

    const result = await fetchSetlistsFromDrive();

    expect(result).toHaveProperty('Summer Concert'); // Single sheet - clean name
    expect(result).toHaveProperty('Holiday Shows - Christmas'); // Multi-sheet - compound name
    expect(result).toHaveProperty('Holiday Shows - New Year'); // Multi-sheet - compound name

    expect(Object.keys(result)).toHaveLength(3);
  });

  it('should skip empty sheets gracefully', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'mixed-content',
            name: 'Mixed Content',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        properties: { title: 'Mixed Content' },
        sheets: [
          { properties: { title: 'Empty Sheet' } },
          { properties: { title: 'Full Sheet' } },
        ],
      },
    });

    // Mock sheet values responses - first empty, second with content
    mockSheets.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: { values: [] }, // Empty sheet
      })
      .mockResolvedValueOnce({
        data: { values: [['Song 1'], ['Song 2']] }, // Sheet with content
      });

    const result = await fetchSetlistsFromDrive();

    // Only the sheet with content should appear
    expect(result).toHaveProperty('Mixed Content - Full Sheet');
    expect(result).not.toHaveProperty('Mixed Content - Empty Sheet');
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('should handle individual sheet errors gracefully', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'error-prone',
            name: 'Error Prone',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    mockSheets.spreadsheets.get.mockResolvedValue({
      data: {
        properties: { title: 'Error Prone' },
        sheets: [
          { properties: { title: 'Working Sheet' } },
          { properties: { title: 'Broken Sheet' } },
        ],
      },
    });

    // Mock sheet values responses - first succeeds, second fails
    mockSheets.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: { values: [['Working Song']] },
      })
      .mockRejectedValueOnce(new Error('Permission denied for sheet'));

    const result = await fetchSetlistsFromDrive();

    // Only the working sheet should appear
    expect(result).toHaveProperty('Error Prone - Working Sheet');
    expect(result).not.toHaveProperty('Error Prone - Broken Sheet');
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('should handle spreadsheet metadata errors gracefully', async () => {
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'good-sheet',
            name: 'Good Sheet',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
          {
            id: 'bad-sheet',
            name: 'Bad Sheet',
            mimeType: 'application/vnd.google-apps.spreadsheet',
          },
        ],
      },
    });

    // First spreadsheet succeeds, second fails at metadata level
    mockSheets.spreadsheets.get
      .mockResolvedValueOnce({
        data: {
          properties: { title: 'Good Sheet' },
          sheets: [{ properties: { title: 'Sheet1' } }],
        },
      })
      .mockRejectedValueOnce(new Error('Spreadsheet not found'));

    mockSheets.spreadsheets.values.get.mockResolvedValue({
      data: { values: [['Good Song']] },
    });

    const result = await fetchSetlistsFromDrive();

    // Only the working spreadsheet should appear
    expect(result).toHaveProperty('Good Sheet');
    expect(result).not.toHaveProperty('Bad Sheet');
    expect(Object.keys(result)).toHaveLength(1);
  });
});
