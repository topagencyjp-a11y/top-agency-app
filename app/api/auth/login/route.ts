import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPREdkeBmMVJ-tCg5ih_wUrHnwZ4Ypv_m4hNHeo2oDogZEA0UOinSaiAZieU9WQSEH_w/exec';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (!name || !password) return NextResponse.json({ success: false });

  try {
    const res  = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAccount', name, password }),
    });
    const data = await res.json();
    if (!data.account) return NextResponse.json({ success: false });

    const token = createToken(data.account);
    return NextResponse.json({ success: true, token, user: data.account });
  } catch {
    return NextResponse.json({ success: false });
  }
}
