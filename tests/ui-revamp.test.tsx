// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CategoryShortcuts } from '../src/components/CategoryShortcuts';
import { Gallery } from '../src/components/Gallery';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { getCategory, homeCategorySlugs, isValidCategory } from '../src/config/categories';

afterEach(cleanup);

describe('home category shortcuts', () => {
  it('only uses real categories', () => {
    for (const slug of homeCategorySlugs) expect(isValidCategory(slug)).toBe(true);
  });

  it('links every shortcut plus the full directory', () => {
    render(<MemoryRouter><CategoryShortcuts /></MemoryRouter>);
    for (const slug of homeCategorySlugs) {
      const link = screen.getByRole('link', { name: getCategory(slug).label });
      expect(link.getAttribute('href')).toBe(`/category/${slug}`);
    }
    expect(screen.getByRole('link', { name: /all categories/i }).getAttribute('href')).toBe('/categories');
  });
});

describe('safety panel', () => {
  it('leads with the category advice and tucks the generic advice away', () => {
    render(<MemoryRouter><SafetyPanel category="phones" /></MemoryRouter>);
    expect(screen.getByText(/imei/i)).toBeTruthy();
    expect(screen.getByText(/more safety tips/i)).toBeTruthy();
  });

  it('shows the generic advice directly when a category has none', () => {
    render(<MemoryRouter><SafetyPanel category="other" /></MemoryRouter>);
    expect(screen.queryByText(/more safety tips/i)).toBeNull();
    expect(screen.getByRole('link', { name: /read all safety tips/i })).toBeTruthy();
  });
});

describe('gallery', () => {
  it('shows a photo counter and moves on swipe', () => {
    const { container } = render(<Gallery images={['a.jpg', 'b.jpg', 'c.jpg']} category="phones" title="Phone" />);
    expect(screen.getByText('1/3')).toBeTruthy();
    const main = container.querySelector('.gallery-main') as HTMLElement;
    fireEvent.touchStart(main, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 80 }] });
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.touchStart(main, { touches: [{ clientX: 80 }] });
    fireEvent.touchEnd(main, { changedTouches: [{ clientX: 200 }] });
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('hides the counter for a single photo', () => {
    render(<Gallery images={['a.jpg']} category="phones" title="Phone" />);
    expect(screen.queryByText('1/1')).toBeNull();
  });
});
