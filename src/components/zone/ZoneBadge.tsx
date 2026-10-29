'use client';

// "Verified merchant" beside a seller — Zone's verdict, presented (C-120). The badge is a
// LINK to the evidence on Zone, so a buyer never has to take Ecommerce's word for it.
// It renders only when the BFF says Zone verified this seller; nothing is guessed here.
import { useTranslation } from '@/lib/i18n';

export interface SellerVerified { name: string; url: string }

const WORDS = {
  en: { label: 'Zone Verified', title: 'Verified merchant on TEC Zone — see the evidence' },
  ar: { label: 'موثّق في Zone', title: 'تاجر موثّق في TEC Zone — اطّلع على الأدلة' },
} as const;

export function ZoneBadge({ verified, size = 'sm' }: { verified: SellerVerified | null | undefined; size?: 'sm' | 'md' }) {
  const { locale } = useTranslation();
  if (!verified) return null;
  const w = WORDS[locale === 'ar' ? 'ar' : 'en'];
  const md = size === 'md';
  return (
    <a
      href={verified.url}
      target="_blank"
      rel="noopener noreferrer"
      title={w.title}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: md ? 5 : 3,
        fontSize: md ? 12 : 9.5, fontWeight: 800, lineHeight: 1,
        color: '#FBB44A', background: 'rgba(251,180,74,0.12)', border: '1px solid rgba(251,180,74,0.35)',
        borderRadius: 999, padding: md ? '5px 10px' : '3px 7px', textDecoration: 'none', whiteSpace: 'nowrap',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <svg width={md ? 13 : 10} height={md ? 13 : 10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      {w.label}
    </a>
  );
}
