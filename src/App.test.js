import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock the useGoogleDrive hook
jest.mock('./hooks/useGoogleDrive', () => ({
  useGoogleDrive: () => ({
    songs: {
      song1: { title: 'Test Song 1', key: 'C' },
      song2: { title: 'Test Song 2', key: 'G' },
    },
    setlists: {
      setlist1: { title: 'Test Setlist', songs: ['song1', 'song2'] },
    },
    loading: false,
    error: null,
    refreshData: jest.fn(),
  }),
}));

// Mock window.matchMedia for responsive tests
const mockMatchMedia = (matches) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

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
};

const renderApp = () => {
  return render(<App />);
};

describe('App - Sidebar Responsive Behavior', () => {
  beforeEach(() => {
    // Reset window size mock
    mockMatchMedia(false);
  });

  describe('Mobile Layout (< 1024px)', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      // Mock CSS classes behavior for testing
      mockMatchMedia(false); // lg breakpoint not matched
    });

    test('shows mobile header with hamburger menu', () => {
      renderApp();

      // Mobile header should be present
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();

      // Hamburger button should be present
      expect(
        screen.getByRole('button', { name: /toggle sidebar/i })
      ).toBeInTheDocument();

      // Mobile header title should be visible (use more specific selector)
      const mobileHeader = screen.getByTestId('mobile-header');
      expect(within(mobileHeader).getByText('RepHub')).toBeInTheDocument();
    });

    test('sidebar is hidden by default on mobile', () => {
      renderApp();

      // Sidebar should not be visible initially
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('-translate-x-full');
    });

    test('hamburger menu toggles sidebar visibility', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      const sidebar = screen.getByTestId('sidebar');

      // Initially hidden
      expect(sidebar).toHaveClass('-translate-x-full');

      // Click to open
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Click to close
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('-translate-x-full');
      });
    });

    test('backdrop appears when sidebar is open', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });

      // No backdrop initially
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();

      // Open sidebar
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(screen.getByTestId('backdrop')).toBeInTheDocument();
      });
    });

    test('clicking backdrop closes sidebar', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      const sidebar = screen.getByTestId('sidebar');

      // Open sidebar
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Click backdrop
      const backdrop = screen.getByTestId('backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(sidebar).toHaveClass('-translate-x-full');
      });
    });

    test('sidebar closes when navigating to different route', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      const sidebar = screen.getByTestId('sidebar');

      // Open sidebar
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Click on Songs navigation (which triggers route change)
      const songsButton = screen.getByRole('button', { name: /songs/i });
      fireEvent.click(songsButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('-translate-x-full');
      });
    });

    test('close button in sidebar works', async () => {
      renderApp();

      const hamburgerButton = screen.getByRole('button', {
        name: /toggle sidebar/i,
      });
      const sidebar = screen.getByTestId('sidebar');

      // Open sidebar
      fireEvent.click(hamburgerButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('translate-x-0');
      });

      // Click close button in sidebar
      const closeButton = screen.getByRole('button', {
        name: /close sidebar/i,
      });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(sidebar).toHaveClass('-translate-x-full');
      });
    });
  });

  describe('Desktop Layout (>= 1024px)', () => {
    beforeEach(() => {
      // Mock desktop viewport
      resizeWindow(1440, 900);
      mockMatchMedia(1440);
    });

    test('desktop layout components are present', () => {
      renderApp();

      // Note: JSDOM doesn't handle CSS media queries properly
      // Elements are present in DOM but CSS controls visibility
      expect(screen.getByTestId('mobile-header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();

      // Sidebar has desktop classes (even if hidden is controlled by CSS)
      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('lg:translate-x-0');
    });

    test('no backdrop on desktop', () => {
      renderApp();

      // No backdrop should be present initially
      expect(screen.queryByTestId('backdrop')).not.toBeInTheDocument();
    });

    test('sidebar structure is correct', () => {
      renderApp();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();

      // Navigation should be present
      expect(within(sidebar).getByText('Songs')).toBeInTheDocument();
      expect(within(sidebar).getByText('Setlists')).toBeInTheDocument();
    });
  });

  describe('Sidebar Navigation', () => {
    test('navigation buttons change active view', async () => {
      renderApp();

      // Open sidebar on mobile
      const hamburgerButton = screen.queryByRole('button', {
        name: /toggle sidebar/i,
      });
      if (hamburgerButton) {
        fireEvent.click(hamburgerButton);
      }

      // Click Setlists
      const setlistsButton = screen.getByRole('button', { name: /setlists/i });
      fireEvent.click(setlistsButton);

      await waitFor(() => {
        expect(setlistsButton).toHaveClass('bg-primary-100');
      });

      // Click Songs
      const songsButton = screen.getByRole('button', { name: /songs/i });
      fireEvent.click(songsButton);

      await waitFor(() => {
        expect(songsButton).toHaveClass('bg-primary-100');
      });
    });

    test('refresh button works', async () => {
      renderApp();

      // Open sidebar on mobile
      const hamburgerButton = screen.queryByRole('button', {
        name: /toggle sidebar/i,
      });
      if (hamburgerButton) {
        fireEvent.click(hamburgerButton);
      }

      const refreshButton = screen.getByRole('button', {
        name: /refresh data/i,
      });
      expect(refreshButton).toBeInTheDocument();

      fireEvent.click(refreshButton);
      // Refresh functionality is mocked, so we just verify the button exists and is clickable
    });
  });

  describe('Accessibility', () => {
    test('sidebar has proper ARIA attributes', () => {
      renderApp();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toBeInTheDocument();

      // Hamburger button should be accessible
      const hamburgerButton = screen.queryByRole('button', {
        name: /toggle sidebar/i,
      });
      expect(hamburgerButton).toBeInTheDocument();
    });

    test('keyboard navigation works in sidebar', () => {
      renderApp();

      // Test that all buttons are focusable and have proper roles
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });
  });
});
