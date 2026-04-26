import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPREdkeBmMVJ-tCg5ih_wUrHnwZ4Ypv_m4hNHeo2oDogZEA0UOinSaiAZieU9WQSEH_w/exec';
const MANAGER_PASSWORD = 'topMgr2024!';
const MEMBER_PASSWORD  = 'top2024';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  if (!name || !password) return NextResponse.json({ success: false });

  // 1. 個別パスワード方式（新GASのgetAccount）
  try {
    const res  = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAccount', name, password }),
    });
    const data = await res.json();
    if (data.account) {
      const token = createToken(data.account);
      return NextResponse.json({ success: true, token, user: data.account });
    }
  } catch {}

  // 2. フォールバック: GASのgetMembersでメンバー確認 + パスワード照合
  if (password === MANAGER_PASSWORD || password === MEMBER_PASSWORD) {
    try {
      const res  = await fetch(`${GAS_URL}?action=getMembers`);
      const data = await res.json();
      const member = (data.members ?? []).find((m: any) => m.name === name);
      if (member) {
        const payload = {
          id:        String(member.id || name),
          name:      String(member.name),
          role:      String(member.role || 'closer'),
          isManager: password === MANAGER_PASSWORD,
        };
        const token = createToken(payload);
        return NextResponse.json({ success: true, token, user: payload });
      }
    } catch {}
  }

  return NextResponse.json({ success: false });
}
