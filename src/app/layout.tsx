import type { Metadata } from 'next';
import Script            from 'next/script';
import PiSdkLoader       from '@/components/PiSdkLoader';
import { LocaleProvider } from '@/lib/i18n';
import './globals.css';
import { ArrivalReport } from '@/components/pioneer/ArrivalReport';

export const metadata: Metadata = {
  title:       'TEC Ecommerce',
  description: 'TEC Ecosystem Ecommerce',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';
  return (
    <html lang="en">
      <head>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="afterInteractive" />
      </head>
      <body>
        <PiSdkLoader sandbox={sandbox} />
        <LocaleProvider>
          <ArrivalReport />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
