import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { MEMBERS } from '@/lib/members';

const MEMBER_PASSWORD = 'top2024';
const MANAGER_PASSWORD = 'topMgr2024!';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name || (password !== MEMBER_PASSWORD && password !== MANAGER_PASSWORD)) {
    return NextResponse.json({ success: false });
  }

  const isManagerPassword = password === MANAGER_PASSWORD;
  const hardcodedMember = MEMBERS.find(m => m.name === name);

  const isManagerLogin = isManagerPassword && (hardcodedMember?.isManager ?? isManagerPassword);

  const payload = {
    id: hardcodedMember?.id ?? name,
    name,
    role: hardcodedMember?.role ?? 'closer',
    isManager: isManagerLogin,
  };
  const token = createToken(payload);
  return NextResponse.json({ success: true, token, user: payload });
}
