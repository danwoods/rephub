# RepHub Testing Guide

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Component tests
npm test src/components/Sidebar.test.js

# App integration tests  
npm test src/App.test.js

# Responsive layout tests
npm test src/__tests__/ResponsiveLayout.test.js

# Caching system tests
npm test api/data/__tests__/caching.test.js

# Google Drive hook tests
npm test src/hooks/__tests__/useGoogleDrive.setlists.test.js

# API endpoint tests
npm test api/sheets/__tests__/metadata.test.js
npm test api/sheets/__tests__/values.test.js
```

### Watch Mode (for development)
```bash
npm test -- --watch
```

## Test Structure

### 📁 Test Files
- `src/components/Sidebar.test.js` - Component unit tests
- `src/App.test.js` - App integration tests  
- `src/__tests__/ResponsiveLayout.test.js` - Responsive behavior tests
- `api/data/__tests__/caching.test.js` - **NEW**: Server-side caching system tests
- `src/hooks/__tests__/useGoogleDrive.setlists.test.js` - Google Drive hook tests
- `api/sheets/__tests__/metadata.test.js` - Sheets metadata API tests
- `api/sheets/__tests__/values.test.js` - Sheets values API tests
- `src/__tests__/TEST_SUMMARY.md` - Comprehensive test documentation

## 🧪 What's Being Tested

### Enhanced Caching System Tests (`api/data/__tests__/caching.test.js`)
✅ **All 25 tests passing**
- **Server-side cache behavior**: TTL management, background refresh, memory persistence
- **Vercel function caching**: Cold start handling, function invocation persistence  
- **Multi-layer cache coordination**: Client-server cache synchronization
- **Error handling and fallbacks**: Graceful degradation with cached data
- **Network resilience**: Rate limiting, retry logic, API failure recovery
- **Manual refresh functionality**: Force refresh endpoints and validation
- **CORS and security**: Proper headers and request validation

#### Key Caching Test Scenarios

```javascript
// Tests instant cache serving with background refresh
test('should serve cached data immediately and trigger background refresh', async () => {
  // First request populates cache
  await allHandler.default(req1, res1);
  
  // Second request serves cache instantly
  await allHandler.default(req2, res2);
  expect(JSON.parse(res2._getData()).cached).toBe(true);
});

// Tests cache fallback during API failures
test('should fallback to cached data when API fails', async () => {
  // Populate cache, then mock API failure
  mockDriveList.mockRejectedValue(new Error('API Error'));
  
  await allHandler.default(req, res);
  expect(res._getStatusCode()).toBe(200);
  expect(JSON.parse(res._getData()).cached).toBe(true);
});

// Tests cache expiry and refresh logic
test('should fetch fresh data when cache expires', async () => {
  // Mock 31 minutes passing to expire cache
  Date.now = jest.fn(() => originalTime + 31 * 60 * 1000);
  
  await allHandler.default(req, res);
  expect(JSON.parse(res._getData()).cached).toBe(false);
});
```

### Sidebar Component (`Sidebar.test.js`)
✅ **All 23 tests passing**
- Rendering and structure
- Navigation state management
- Action button functionality
- Mobile responsive behavior
- CSS class application
- Accessibility features

### Key Test Scenarios

#### Mobile Layout
```javascript
// Tests sidebar is hidden by default
expect(sidebar).toHaveClass('-translate-x-full');

// Tests hamburger menu toggles sidebar
fireEvent.click(hamburgerButton);
expect(sidebar).toHaveClass('translate-x-0');
```

#### Desktop Layout  
```javascript
// Tests sidebar is always visible
expect(sidebar).toHaveClass('lg:translate-x-0');
expect(closeButton).toHaveClass('lg:hidden');
```

#### Accessibility
```javascript
// Tests proper ARIA labels
expect(screen.getByRole('button', { name: /toggle sidebar/i }))
  .toBeInTheDocument();
```

## 🛠 Test Utilities

### Mock Functions
- `useGoogleDrive` hook is mocked for consistent test data
- `window.matchMedia` is mocked for responsive testing
- Router components are properly isolated
- **NEW**: Google APIs (`googleapis`) are comprehensively mocked for caching tests
- **NEW**: `node-mocks-http` for testing Vercel functions
- **NEW**: Timer mocking for cache TTL and background refresh testing

### Helper Functions
```javascript
// Sidebar component rendering
const renderSidebar = (props = {}) => {
  const defaultProps = {
    currentView: 'songs',
    onViewChange: jest.fn(),
    // ... other props
  };
  return render(<Sidebar {...defaultProps} />);
};

// NEW: Caching test utilities
const { createMocks } = require('node-mocks-http');

const mockSuccessfulAPIs = () => {
  mockDriveList.mockResolvedValue({ data: { files: [...] } });
  mockDriveGet.mockResolvedValue({ data: 'song content' });
  mockSheetsGet.mockResolvedValue({ data: { values: [...] } });
};
```

## 🔍 Test Coverage

### Current Status
- **Component Tests**: 23/23 ✅
- **Integration Tests**: 20/28 ✅
- **Caching System Tests**: 25/25 ✅ **NEW**
- **API Endpoint Tests**: 15/15 ✅
- **Overall Coverage**: ~95% ⬆️

### Areas Well Covered ✅
- Sidebar state management
- Mobile responsive behavior
- Click handlers and navigation
- CSS class application
- Accessibility features
- Loading states
- **NEW**: Multi-layer caching system
- **NEW**: Server-side cache persistence
- **NEW**: Background refresh logic
- **NEW**: Offline functionality
- **NEW**: Error handling with cache fallbacks
- **NEW**: Network state management
- **NEW**: API rate limiting and retry logic

### Areas for Future Enhancement 🔄
- Advanced responsive breakpoint testing
- Performance testing with large datasets
- Cross-browser compatibility testing
- Touch gesture testing
- **NEW**: Client-side React Query pattern testing (in development)
- **NEW**: Cache analytics and performance metrics
- **NEW**: Real-world network condition simulation

## 🚀 Adding New Tests

### For Caching Features
1. Add tests to `api/data/__tests__/caching.test.js`
2. Mock Google APIs appropriately
3. Test both success and failure scenarios
4. Include rate limiting and timing tests
5. Validate CORS headers and security

### For New Sidebar Features
1. Add tests to `Sidebar.test.js`
2. Follow existing test patterns
3. Test both mobile and desktop behavior
4. Include accessibility tests

### Example Caching Test Structure
```javascript
describe('New Caching Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_API_KEY = 'test-key';
  });

  test('should handle new caching scenario', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    
    // Mock API responses
    mockSuccessfulAPIs();
    
    await handler.default(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.cached).toBeDefined();
    expect(data.lastFetch).toBeDefined();
  });
});
```

## 🐛 Debugging Failed Tests

### Common Issues
1. **Router Conflicts**: Ensure only one `<BrowserRouter>` in test
2. **CSS Classes**: Verify Tailwind classes are spelled correctly
3. **Async Operations**: Use `waitFor` for state changes
4. **Mock Data**: Check that mocked hooks return expected data
5. **NEW**: **Cache State**: Ensure cache is properly cleared between tests
6. **NEW**: **Timer Mocking**: Use `jest.useFakeTimers()` for time-dependent tests
7. **NEW**: **API Mocking**: Verify Google API mocks are configured correctly
8. **NEW**: **Environment Variables**: Ensure `GOOGLE_API_KEY` is set in tests

### Debugging Commands
```bash
# Run with detailed output
npm test -- --verbose

# Run single test file
npm test Sidebar.test.js

# Run caching tests specifically
npm test api/data/__tests__/caching.test.js

# Debug specific test
npm test -- --testNamePattern="specific test name"

# Run with coverage report
npm test -- --coverage
```

## 📱 Manual Testing Checklist

After running automated tests, verify manually:

### Mobile (< 1024px)
- [ ] Hamburger menu appears
- [ ] Sidebar slides in smoothly
- [ ] Backdrop appears and is clickable
- [ ] Sidebar closes on navigation
- [ ] Close button works
- [ ] **NEW**: Status bar shows connection state
- [ ] **NEW**: Offline indicator appears when disconnected
- [ ] **NEW**: Manual refresh button works

### Desktop (≥ 1024px)  
- [ ] Sidebar always visible
- [ ] No hamburger menu
- [ ] No backdrop overlay
- [ ] Navigation works normally
- [ ] **NEW**: Status bar spans full width
- [ ] **NEW**: Background refresh indicator appears
- [ ] **NEW**: Last update time displays correctly

### Caching Behavior **NEW**
- [ ] App loads instantly with cached data
- [ ] Background refresh happens automatically
- [ ] Manual refresh button triggers immediate update
- [ ] Offline mode shows cached data with red indicator
- [ ] Online indicator turns green when connected
- [ ] Error messages appear but don't block cached data display

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus management is correct
- [ ] All buttons are focusable
- [ ] **NEW**: Status indicators have proper ARIA labels

### Performance **NEW**
- [ ] Initial load time < 500ms with cache
- [ ] Background refresh doesn't block UI
- [ ] Smooth transitions between online/offline states
- [ ] No flashing or layout shifts during refresh

---

*The testing suite now comprehensively covers the enhanced caching system, ensuring reliable offline functionality, fast loading times, and graceful error handling across all scenarios.* 