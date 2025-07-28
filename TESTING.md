# RepHub Testing Guide

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Sidebar component tests only
npm test src/components/Sidebar.test.js

# App integration tests only  
npm test src/App.test.js

# Responsive layout tests only
npm test src/__tests__/ResponsiveLayout.test.js
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
- `src/__tests__/TEST_SUMMARY.md` - Comprehensive test documentation

## 🧪 What's Being Tested

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
```

## 🔍 Test Coverage

### Current Status
- **Component Tests**: 23/23 ✅
- **Integration Tests**: 20/28 ⚠️
- **Overall Coverage**: ~85%

### Areas Well Covered ✅
- Sidebar state management
- Mobile responsive behavior
- Click handlers and navigation
- CSS class application
- Accessibility features
- Loading states

### Areas for Future Enhancement 🔄
- Advanced responsive breakpoint testing
- Performance testing with large datasets
- Cross-browser compatibility testing
- Touch gesture testing

## 🚀 Adding New Tests

### For New Sidebar Features
1. Add tests to `Sidebar.test.js`
2. Follow existing test patterns
3. Test both mobile and desktop behavior
4. Include accessibility tests

### Example Test Structure
```javascript
describe('New Feature', () => {
  test('renders correctly', () => {
    renderSidebar({ newProp: true });
    expect(screen.getByTestId('new-feature')).toBeInTheDocument();
  });

  test('handles interactions', async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /new action/i }));
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });
});
```

## 🐛 Debugging Failed Tests

### Common Issues
1. **Router Conflicts**: Ensure only one `<BrowserRouter>` in test
2. **CSS Classes**: Verify Tailwind classes are spelled correctly
3. **Async Operations**: Use `waitFor` for state changes
4. **Mock Data**: Check that mocked hooks return expected data

### Debugging Commands
```bash
# Run with detailed output
npm test -- --verbose

# Run single test file
npm test Sidebar.test.js

# Debug specific test
npm test -- --testNamePattern="specific test name"
```

## 📱 Manual Testing Checklist

After running automated tests, verify manually:

### Mobile (< 1024px)
- [ ] Hamburger menu appears
- [ ] Sidebar slides in smoothly
- [ ] Backdrop appears and is clickable
- [ ] Sidebar closes on navigation
- [ ] Close button works

### Desktop (≥ 1024px)  
- [ ] Sidebar always visible
- [ ] No hamburger menu
- [ ] No backdrop overlay
- [ ] Navigation works normally

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus management is correct
- [ ] All buttons are focusable

---

*Keep tests updated as you add new features to maintain high quality and reliability.* 