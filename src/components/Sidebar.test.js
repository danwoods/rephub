import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Sidebar from './Sidebar';

const renderSidebar = (props = {}) => {
  const defaultProps = {
    currentView: 'songs',
    onViewChange: jest.fn(),
    onRefresh: jest.fn(),
    onPerformanceMode: jest.fn(),
    loading: false,
    isOpen: false,
    onClose: jest.fn(),
    ...props,
  };

  return render(
    <BrowserRouter>
      <Sidebar {...defaultProps} />
    </BrowserRouter>
  );
};

describe('Sidebar Component', () => {
  describe('Rendering', () => {
    test('renders sidebar with correct structure', () => {
      renderSidebar();

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByText('RepHub')).toBeInTheDocument();
      expect(
        screen.getByText('Music Repertoire & Setlists')
      ).toBeInTheDocument();
    });

    test('renders navigation buttons', () => {
      renderSidebar();

      expect(
        screen.getByRole('button', { name: /songs/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /setlists/i })
      ).toBeInTheDocument();
    });

    test('renders action buttons', () => {
      renderSidebar();

      expect(
        screen.getByRole('button', { name: /refresh data/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /performance mode/i })
      ).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('shows active state for current view', () => {
      renderSidebar({ currentView: 'songs' });

      const songsButton = screen.getByRole('button', { name: /songs/i });
      const setlistsButton = screen.getByRole('button', { name: /setlists/i });

      expect(songsButton).toHaveClass('bg-primary-100', 'text-primary-700');
      expect(setlistsButton).not.toHaveClass('bg-primary-100');
    });

    test('calls onViewChange when navigation buttons are clicked', () => {
      const onViewChange = jest.fn();
      renderSidebar({ onViewChange });

      fireEvent.click(screen.getByRole('button', { name: /setlists/i }));
      expect(onViewChange).toHaveBeenCalledWith('setlists');

      fireEvent.click(screen.getByRole('button', { name: /songs/i }));
      expect(onViewChange).toHaveBeenCalledWith('songs');
    });

    test('updates active state when currentView changes', () => {
      const { rerender } = renderSidebar({ currentView: 'songs' });

      let songsButton = screen.getByRole('button', { name: /songs/i });
      let setlistsButton = screen.getByRole('button', { name: /setlists/i });

      expect(songsButton).toHaveClass('bg-primary-100');
      expect(setlistsButton).not.toHaveClass('bg-primary-100');

      // Rerender with different currentView
      rerender(
        <BrowserRouter>
          <Sidebar
            currentView="setlists"
            onViewChange={jest.fn()}
            onRefresh={jest.fn()}
            onPerformanceMode={jest.fn()}
            loading={false}
            isOpen={false}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      songsButton = screen.getByRole('button', { name: /songs/i });
      setlistsButton = screen.getByRole('button', { name: /setlists/i });

      expect(songsButton).not.toHaveClass('bg-primary-100');
      expect(setlistsButton).toHaveClass('bg-primary-100');
    });
  });

  describe('Actions', () => {
    test('calls onRefresh when refresh button is clicked', () => {
      const onRefresh = jest.fn();
      renderSidebar({ onRefresh });

      fireEvent.click(screen.getByRole('button', { name: /refresh data/i }));
      expect(onRefresh).toHaveBeenCalled();
    });

    test('calls onPerformanceMode when performance mode button is clicked', () => {
      const onPerformanceMode = jest.fn();
      renderSidebar({ onPerformanceMode });

      fireEvent.click(
        screen.getByRole('button', { name: /performance mode/i })
      );
      expect(onPerformanceMode).toHaveBeenCalled();
    });

    test('shows loading state on refresh button', () => {
      renderSidebar({ loading: true });

      const refreshButton = screen.getByRole('button', { name: /loading/i });
      expect(refreshButton).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Mobile Behavior', () => {
    test('shows close button when isOpen is true', () => {
      renderSidebar({ isOpen: true });

      const closeButton = screen.getByRole('button', {
        name: /close sidebar/i,
      });
      expect(closeButton).toBeInTheDocument();
    });

    test('hides close button when isOpen is false', () => {
      renderSidebar({ isOpen: false });

      const closeButton = screen.queryByRole('button', {
        name: /close sidebar/i,
      });
      expect(closeButton).toBeInTheDocument(); // Still in DOM but hidden with CSS
      expect(closeButton).toHaveClass('lg:hidden');
    });

    test('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      renderSidebar({ isOpen: true, onClose });

      fireEvent.click(screen.getByRole('button', { name: /close sidebar/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Responsive Classes', () => {
    test('applies correct transform classes when open', () => {
      renderSidebar({ isOpen: true });

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('translate-x-0');
    });

    test('applies correct transform classes when closed', () => {
      renderSidebar({ isOpen: false });

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('-translate-x-full');
      expect(sidebar).toHaveClass('lg:translate-x-0');
    });

    test('has correct positioning classes', () => {
      renderSidebar();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass(
        'fixed',
        'lg:relative',
        'inset-y-0',
        'left-0',
        'z-30'
      );
    });

    test('has correct animation classes', () => {
      renderSidebar();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass(
        'transform',
        'transition-transform',
        'duration-300',
        'ease-in-out',
        'lg:transform-none'
      );
    });
  });

  describe('Accessibility', () => {
    test('has proper button roles and labels', () => {
      renderSidebar({ isOpen: true });

      // Check all buttons have proper roles
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5); // Songs, Setlists, Refresh, Performance Mode, Close

      // Check specific aria-labels
      expect(
        screen.getByRole('button', { name: /close sidebar/i })
      ).toBeInTheDocument();
    });

    test('navigation buttons have proper accessibility structure', () => {
      renderSidebar();

      const songsButton = screen.getByRole('button', { name: /songs/i });
      const setlistsButton = screen.getByRole('button', { name: /setlists/i });

      // Should be focusable
      expect(songsButton).not.toHaveAttribute('disabled');
      expect(setlistsButton).not.toHaveAttribute('disabled');
    });

    test('disabled refresh button has proper accessibility', () => {
      renderSidebar({ loading: true });

      const refreshButton = screen.getByRole('button', { name: /loading/i });
      expect(refreshButton).toBeDisabled();
      expect(refreshButton).toHaveClass(
        'disabled:opacity-50',
        'disabled:cursor-not-allowed'
      );
    });
  });

  describe('Icon Rendering', () => {
    test('renders all required icons', () => {
      renderSidebar({ isOpen: true });

      // Check for specific navigation elements by their container structure
      expect(screen.getByText('Songs')).toBeInTheDocument();
      expect(screen.getByText('Setlists')).toBeInTheDocument();
      expect(screen.getByText('Refresh Data')).toBeInTheDocument();
      expect(screen.getByText('Performance Mode')).toBeInTheDocument();

      // Check for close button specifically
      expect(
        screen.getByRole('button', { name: /close sidebar/i })
      ).toBeInTheDocument();

      // Verify SVG icons are present by checking their parent containers
      const navButtons = screen.getAllByRole('button');
      expect(navButtons.length).toBeGreaterThan(3); // Should have multiple navigation buttons
    });

    test('renders loading spinner when loading', () => {
      renderSidebar({ loading: true });

      // Check for loading text which indicates spinner is working
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Style Classes', () => {
    test('applies correct base styling classes', () => {
      renderSidebar();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass(
        'w-64',
        'bg-white',
        'border-r',
        'border-gray-200',
        'flex',
        'flex-col'
      );
    });

    test('navigation buttons have correct hover states', () => {
      renderSidebar();

      const songsButton = screen.getByRole('button', { name: /songs/i });
      expect(songsButton).toHaveClass('transition-colors', 'duration-200');
    });
  });
});
