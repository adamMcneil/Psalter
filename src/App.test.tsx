import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

test('renders the psalm list on the home route', async () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'Psalter' }),
  ).toBeDefined();
  expect(screen.getByText('Psalm of the Day')).toBeDefined();
  // A known psalm row is present and links to its detail page.
  expect(screen.getByText('The Lord Is My Shepherd')).toBeDefined();
});

test('renders a psalm detail page with its songs', () => {
  window.history.pushState({}, '', '/psalm/23');
  render(<App />);
  expect(screen.getByText('PSALM 23')).toBeDefined();
  expect(
    screen.getByRole('heading', { name: 'The Lord Is My Shepherd' }),
  ).toBeDefined();
  // Play/shuffle controls exist when the psalm has songs.
  expect(screen.getByRole('button', { name: 'Play all' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Shuffle' })).toBeDefined();
});

test('search finds psalms by number and songs by text', () => {
  window.history.pushState({}, '', '/search');
  render(<App />);
  const input = screen.getByLabelText('Search');
  fireEvent.change(input, { target: { value: '23' } });
  expect(screen.getByText('The Lord Is My Shepherd')).toBeDefined();
  fireEvent.change(input, { target: { value: 'shepherd' } });
  expect(screen.getAllByText(/shepherd/i).length).toBeGreaterThan(0);
});

test('unknown routes show the not-found page', () => {
  window.history.pushState({}, '', '/definitely-not-a-page');
  render(<App />);
  expect(screen.getByText('Page not found')).toBeDefined();
});
