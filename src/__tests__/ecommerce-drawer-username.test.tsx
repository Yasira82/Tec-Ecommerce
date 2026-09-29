/**
 * The drawer shows who is signed in, on every page.
 *
 * 2026-09-29, from a phone: the Ecommerce menu showed no account. Pages other
 * than Home passed a username read from the tec_user cookie in client JS, which
 * Pi Browser hides (C-123 §3). The drawer now asks the server (/api/auth/me).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n';
import { EcommerceDrawer } from '@/components/shop/EcommerceDrawer';

const drawer = (username?: string) =>
  render(createElement(LocaleProvider, null,
    createElement(EcommerceDrawer, { isOpen: true, onClose: () => {}, username, hubUrl: 'https://hub.tecosystem.app' })));

describe('EcommerceDrawer — the signed-in account', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ authenticated: true, user: { piUsername: 'pioneer_1' } }),
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('with no username from the page, shows the one the server resolves', async () => {
    drawer();
    await waitFor(() => expect(screen.getByText('@pioneer_1')).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('a username the page already has wins', async () => {
    drawer('from_page');
    expect(screen.getByText('@from_page')).toBeTruthy();
  });

  it('no session → no account block, no crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    drawer();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/^@/)).toBeNull();
  });
});
