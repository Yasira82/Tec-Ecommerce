import type { Metadata }  from 'next';
import Script             from 'next/script';
import PiSdkLoader        from '@/components/PiSdkLoader';

export const metadata: Metadata = {
  title:       'TEC Ecommerce',
  description: 'TEC Ecosystem Ecommerce',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';

  return (
    <html lang="en">
      <head>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
      </head>
      <body>
        <PiSdkLoader sandbox={sandbox} />
        {children}
      </body>
    </html>
  );
}
