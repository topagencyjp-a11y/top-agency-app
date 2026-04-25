import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { MEMBERS } from '@/lib/members';

const MEMBER_PASSWORD = 'top2024';
const MANAGER_PASSWORD = 'topMgr2024!';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  const member = MEMBERS.find(m => m.name === name);
  if (!member) return NextResponse.json({ success: false });

  const isManagerLogin = member.isManager && password === MANAGER_PASSWORD;
  const isMemberLogin = password === MEMBER_PASSWORD;

  if (!isManagerLogin && !isMemberLogin) {
    return NextResponse.json({ success: false });
  }

  const payload = {
    id: member.id,
    name: member.name,
    role: member.role,
    isManager: isManagerLogin,
  };
  const token = createToken(payload);
  return NextResponse.json({ success: true, token, user: payload });
}
