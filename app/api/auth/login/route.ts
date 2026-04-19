import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { MEMBERS } from '@/lib/members';

const PASSWORDS: Record<string, string> = {
  'プラ': 'top2024',
  '岩永': 'top2024',
  '橋本': 'top2024',
  '高木': 'top2024',
  '長谷川': 'top2024',
  '中西': 'top2024',
  '佐藤': 'top2024',
  '小島': 'top2024',
};

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();
  const member = MEMBERS.find(m => m.name === name);
  if (!member || PASSWORDS[name] !== password) {
    return NextResponse.json({ success: false });
  }
  const token = createToken({ id: member.id, name: member.name, role: member.role });
  return NextResponse.json({ success: true, token, user: member });
}
