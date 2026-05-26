import { NextRequest, NextResponse } from 'next/server';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbz0KREckErCBIMvD-5yURsUh3CKVmGI5O3H2gkPtYB94QXpXn634o6y3lkTFBqqXPPBNw/exec';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    const data = await gasRes.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, error: 'GAS通信エラー' }, { status: 500 });
  }
}
