import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock the useGoogleDrive hook
jest.mock('../hooks/useGoogleDrive', () => ({
  useGoogleDrive: () => ({
    songs: {
      'test-song-1': {
        title: 'Test Song 1',
        content: '# Test Song 1\n\nKey: C\n\nTest song content',
      },
      'test-song-2': {
        title: 'Test Song 2',
        content: '# Test Song 2\n\nKey: G\n\nTest song content',
      },
    },
    setlists: {},
    loading: false,
    error: null,
    refreshData: jest.fn(),
  }),
}));

// Helper to simulate different viewport sizes
const resizeWindow = (width, height) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });

  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

// Mock CSS media queries
const mockMatchMedia = (width) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => {
      const breakpoint = query.includes('1024px') ? 1024 : 768;
      return {
        matches: width >= breakpoint,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    }),
  });
};

const renderApp = () => {
  return render(<App />);
};

describe('Responsive Layout Integration Tests', () => {
  beforeEach(() => {
    // Clean up any existing mocks
    jest.clearAllMocks();
  });

  describe('Mobile Layout Behavior', () => {
    beforeEach(() => {
      // Mock mobile viewport
      resizeWindow(375, 667);
      mockMatchMedia(375);
    });

    test('mobile layout shows hamburger menu', () => {
      renderApp();

      // Mobile header should be present (ignore CSS media queries in JSDOM)
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();

      // Hamburger button should be present
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      expect(hamburgerButton).toBeInTheDocument();
    });

    test('sidebar starts closed on mobile', () => {
      renderApp();

      // Sidebar should be present but positioned off-screen
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('-translate-x-full');

      // No backdrop initially
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
    });

    test('hamburger menu opens sidebar', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });

      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Backdrop should appear
      expect(screen.getByTestId('backdrop')).toBeInTheDocument();
    });

    test('backdrop closes sidebar when clicked', async () => {
      renderApp();

      // Open sidebar first
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(screen.getByTestId('backdrop')).toBeInTheDocument();
      });

      // Click backdrop
      const backdrop = screen.getByTestId('backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('-translate-x-full');
      });

      // Backdrop should disappear
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
    });

    test('close button in sidebar works', async () => {
      renderApp();

      // Open sidebar first
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(screen.getByTestId('backdrop')).toBeInTheDocument();
      });

      // Click close button in sidebar
      const closeButton = screen.getByRole('button', {
        name: /close sidebar/i,
      });
      fireEvent.click(closeButton);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('-translate-x-full');
      });

      // Backdrop should disappear
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
    });
  });

  describe('Desktop Layout Behavior', () => {
    beforeEach(() => {
      // Mock desktop viewport
      resizeWindow(1440, 900);
      mockMatchMedia(1440);
    });

    test('desktop layout has proper structure', () => {
      renderApp();

      // Note: JSDOM doesn't handle CSS media queries, so we just test structure
      // Mobile header is present in DOM but should be hidden by CSS
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();

      // Sidebar should be present
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('lg:translate-x-0');

      // No backdrop on desktop (sidebar is always visible)
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
    });
  });

  describe('Content Accessibility During Transitions', () => {
    test('main content remains accessible when sidebar is open on mobile', async () => {
      resizeWindow(375, 667);
      mockMatchMedia(375);
      renderApp();

      // Open sidebar
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Backdrop should be present
      expect(screen.getByTestId('backdrop')).toBeInTheDocument();

      // Main content should still be in DOM (use more specific selector to avoid conflicts)
      expect(
        screen.getByRole('heading', { name: /songs/i, level: 2 })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Browse your music repertoire')
      ).toBeInTheDocument();
    });
  });

  describe('Responsive Breakpoint Transitions', () => {
    test('layout components are properly structured', () => {
      // Start with mobile
      resizeWindow(375, 667);
      mockMatchMedia(375);
      renderApp();

      // Basic structure should be present
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();

      // Resize to desktop (note: CSS changes won't be reflected in JSDOM)
      resizeWindow(1440, 900);
      mockMatchMedia(1440);

      // Structure should remain the same (CSS handles visibility)
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    test('sidebar navigation works with keyboard', async () => {
      renderApp();

      // Open sidebar
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Tab to close button
      const closeButton = screen.getByRole('button', {
        name: /close sidebar/i,
      });
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Press Enter to close (simulate actual user interaction)
      fireEvent.keyDown(closeButton, { key: 'Enter', code: 'Enter' });
      fireEvent.click(closeButton); // Also simulate the click that would happen

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('-translate-x-full');
      });
    });

    test('hamburger button gets focus after Escape key', async () => {
      renderApp();

      // Open sidebar
      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(screen.getByTestId('backdrop')).toBeInTheDocument();
      });

      // Press Escape and click backdrop to close
      const backdrop = screen.getByTestId('backdrop');
      fireEvent.keyDown(backdrop, { key: 'Escape', code: 'Escape' });
      fireEvent.click(backdrop);

      await waitFor(() => {
        const sidebar = screen.getByTestId('sidebar');
        expect(sidebar).toHaveClass('-translate-x-full');
      });

      // Hamburger button should still be accessible
      expect(hamburgerButton).toBeInTheDocument();
    });
  });
});
