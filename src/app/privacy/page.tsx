import type { Metadata } from 'next';
import Link from 'next/link';

const APP     = 'TEC Ecommerce';
const DOMAIN  = 'ecommerce.tecosystem.app';
const UPDATED = '21 June 2026';

export const metadata: Metadata = {
  title:       `Privacy Policy — ${APP}`,
  description: `Privacy Policy for ${APP} (${DOMAIN}).`,
};

const wrap = { maxWidth: 820, margin: '0 auto', padding: '48px 22px', color: '#e7e7ea', background: '#050816', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', lineHeight: 1.75 } as const;
const h1   = { color: '#FBBF24', fontSize: 30, marginBottom: 4 } as const;
const h2   = { color: '#FBBF24', fontSize: 19, marginTop: 30, marginBottom: 6 } as const;
const meta = { opacity: 0.65, fontSize: 14, marginBottom: 8 } as const;
const link = { color: '#FBBF24' } as const;

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={meta}>{APP} · {DOMAIN} · Last updated: {UPDATED}</p>

      <h2 style={h2}>1. Overview</h2>
      <p>The Elite Consortium (&quot;TEC&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates {APP}, a Pi-native marketplace built on the Pi Network blockchain. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use {APP}. By accessing or using {APP}, you agree to this Privacy Policy.</p>

      <h2 style={h2}>2. Information We Collect</h2>
      <p><strong>Pi Network identity.</strong> When you authenticate via Pi Network we receive your Pi User ID (UID), Pi username, and access tokens. We never receive or store your Pi password or private keys.</p>
      <p><strong>Transaction data.</strong> We record payment records — transaction identifiers, amounts, timestamps, payment status, and blockchain transaction IDs (txid).</p>
      <p><strong>Session cookies.</strong> We use first-party cookies (<code>tec_access_token</code>, <code>tec_csrf</code>, <code>tec_user</code>) to keep you signed in across the TEC platform and to protect requests. These are not used for advertising or cross-site tracking.</p>
      <p><strong>Usage data.</strong> Technical information such as IP address, browser type, device information, and pages visited.</p>

      <h2 style={h2}>3. How We Use Your Information</h2>
      <ul>
        <li>Authenticate your identity and provide secure access to {APP}</li>
        <li>Process Pi Network payments and maintain accurate order and transaction records</li>
        <li>Fulfil orders and provide customer support</li>
        <li>Detect, investigate, and prevent fraudulent or abusive activity</li>
        <li>Comply with applicable legal obligations</li>
      </ul>

      <h2 style={h2}>4. Security</h2>
      <p>We apply industry-standard safeguards including TLS/SSL encryption, JWT-based authentication with secure token rotation, CSRF protection, and rate limiting on payment endpoints.</p>

      <h2 style={h2}>5. Blockchain &amp; Pi Network</h2>
      <p>Payments are processed on the Pi Network blockchain. Such transactions are immutable and may be publicly visible. {APP} is an independent developer application built on Pi Network and is not affiliated with, endorsed by, or operated by Pi Network or Minepi, Inc.</p>

      <h2 style={h2}>6. Third-Party Services</h2>
      <p>We rely on Pi Network (identity &amp; payments) and our infrastructure providers (hosting and backend services) to deliver {APP}. These providers process data only as needed to operate the service.</p>

      <h2 style={h2}>7. Data Retention</h2>
      <p>We retain transaction and account records for as long as needed to provide the service and to meet legal, accounting, and security obligations.</p>

      <h2 style={h2}>8. Your Rights</h2>
      <ul>
        <li>Access — request a copy of the personal data we hold about you</li>
        <li>Rectification — request correction of inaccurate data</li>
        <li>Erasure — request deletion of your personal data</li>
        <li>Portability — request transfer of your data</li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:privacy@tec.pi" style={link}>privacy@tec.pi</a>.</p>

      <h2 style={h2}>9. Children</h2>
      <p>{APP} is not directed to children under the age required to hold a Pi Network account, and we do not knowingly collect their data.</p>

      <h2 style={h2}>10. Changes</h2>
      <p>We may update this Privacy Policy from time to time. Material changes will be reflected by the &quot;Last updated&quot; date above.</p>

      <h2 style={h2}>11. Contact</h2>
      <p>For privacy-related inquiries, contact The Elite Consortium at <a href="mailto:privacy@tec.pi" style={link}>privacy@tec.pi</a>. We aim to respond within 5 business days.</p>

      <p style={{ marginTop: 40 }}>
        <Link href="/terms" style={link}>Terms of Service</Link>{'  ·  '}
        <Link href="/" style={link}>← Back to {APP}</Link>
      </p>
    </main>
  );
}
