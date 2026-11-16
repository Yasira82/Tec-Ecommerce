/**
 * "Link copied" must be true, and in the person's language.
 *
 * Until 16 Nov 2026 the share fallback alerted a hard-coded English "Link copied!" — and in
 * Assets it alerted it even when the clipboard refused (the error was swallowed first).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyLink } from '@/lib/copy-link';
import { ar } from '@/lib/i18n/ar';

const msgs = { linkCopied: ar.common.linkCopied, linkCopyFailed: ar.common.linkCopyFailed };
afterEach(() => vi.unstubAllGlobals());

describe('copyLink', () => {
  it('says "copied", in the chosen language, only when it was', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const say = vi.fn();
    expect(await copyLink('https://x', msgs, say)).toBe(true);
    expect(say).toHaveBeenCalledWith('تم نسخ الرابط');
  });

  it('says it failed when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const say = vi.fn();
    expect(await copyLink('https://x', msgs, say)).toBe(false);
    expect(say).toHaveBeenCalledWith('تعذّر نسخ الرابط');
  });

  it('says it failed when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', {});
    const say = vi.fn();
    expect(await copyLink('https://x', msgs, say)).toBe(false);
    expect(say).toHaveBeenCalledWith('تعذّر نسخ الرابط');
  });
});
