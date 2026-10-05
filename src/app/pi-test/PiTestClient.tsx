'use client';

import { ArrivalTracePanel } from './ArrivalTracePanel';

export function PiTestClient() {
  return (
    <main style={{ fontFamily: 'monospace', maxWidth: 800, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>TEC Ecommerce Diagnostic</h1>
      <p style={{ fontSize: '0.82rem', color: '#666' }}>
        Pi Test — service health checks removed for security.
      </p>
      {/* Why a campaign mission did or did not tick — this tab's Pi sign-in and arrival report. */}
      <ArrivalTracePanel />
    </main>
  );
}
