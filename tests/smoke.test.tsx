// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';
import { ToastProvider } from '../src/context/ToastContext';

// No network in tests: every Supabase request fails fast, which exercises the error and empty states.
vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
window.scrollTo = () => undefined;

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('routes render without crashing', () => {
  it('home page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /buy and sell/i })).toBeTruthy();
    expect(screen.getByText(/a safe deal, step by step/i)).toBeTruthy();
  });

  it('categories directory lists many categories', async () => {
    renderAt('/categories');
    expect(await screen.findByRole('heading', { name: /all categories/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /phones & tablets/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /house helps/i }).length).toBeGreaterThan(0);
  });

  it('browse page', async () => {
    renderAt('/browse?cat=phones');
    expect(await screen.findByRole('heading', { level: 1, name: /phones & tablets/i })).toBeTruthy();
  });

  it('safety and rules pages', async () => {
    renderAt('/safety');
    expect(await screen.findByRole('heading', { level: 1, name: /safety tips/i })).toBeTruthy();
    cleanup();
    renderAt('/rules');
    expect(await screen.findByRole('heading', { name: /rules and privacy/i })).toBeTruthy();
  });

  it('login and signup pages offer Google and email', async () => {
    renderAt('/signup');
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy();
    cleanup();
    renderAt('/login');
    expect(await screen.findByRole('button', { name: /^log in$/i })).toBeTruthy();
  });

  it('sell page sends signed-out visitors to log in', async () => {
    renderAt('/sell');
    expect(await screen.findByRole('heading', { level: 1, name: /continue to maua marketplace|log in/i })).toBeTruthy();
  });

  it('unknown routes show not found', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeTruthy();
  });
});
