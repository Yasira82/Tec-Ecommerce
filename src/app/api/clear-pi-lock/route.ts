import { NextResponse } from 'next/server';

export async function GET() {
  const pid    = 'TG7uZCch44mt3Q6koqfQLnaYBLm0';
  const apiKey = 'o7kvmz1lo6cklitjfuclcifcrbfr8e8qqg7n26dcfpjmook96eo0n5jqiweus0ov';

  const results: Record<string, unknown> = {};

  try {
    const res = await fetch(`https://api.minepi.com/v2/payments/${pid}/complete`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid: '' }),
    });
    results.complete = { status: res.status, data: await res.text().catch(() => '') };
  } catch (e) { results.complete = { error: String(e) }; }

  try {
    const res = await fetch(`https://api.minepi.com/v2/payments/${pid}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    });
    results.cancel = { status: res.status, data: await res.text().catch(() => '') };
  } catch (e) { results.cancel = { error: String(e) }; }

  return NextResponse.json({ success: true, pid, results });
}
