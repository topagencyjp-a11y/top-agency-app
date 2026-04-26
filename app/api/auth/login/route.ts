import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { MEMBERS } from '@/lib/members';

const MEMBER_PASSWORD = 'top2024';
const MANAGER_PASSWORD = 'topMgr2024!';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxPREdkeBmMVJ-tCg5ih_wUrHnwZ4Ypv_m4hNHeo2oDogZEA0UOinSaiAZieU9WQSEH_w/exec';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name || (password !== MEMBER_PASSWORD && password !== MANAGER_PASSWORD)) {
    return NextResponse.json({ success: false });
  }

  const isManagerPassword = password === MANAGER_PASSWORD;
  const hardcodedMember = MEMBERS.find(m => m.name === name);

  // 設定ページで動的変更された isManager も確認
  let gasMember: any = null;
  try {
    const res = await fetch(`${GAS_URL}?action=getMembers`);
    const data = await res.json();
    gasMember = (data.members ?? []).find((m: any) => m.name === name) ?? null;
  } catch {}

  const isManagerLogin = isManagerPassword && (
    hardcodedMember?.isManager === true || gasMember?.isManager === true
  );

  const payload = {
    id: hardcodedMember?.id ?? gasMember?.id ?? name,
    name,
    role: hardcodedMember?.role ?? gasMember?.role ?? 'closer',
    isManager: isManagerLogin,
  };
  const token = createToken(payload);
  return NextResponse.json({ success: true, token, user: payload });
}
