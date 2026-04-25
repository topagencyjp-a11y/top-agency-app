import { MEMBERS as DEFAULT_MEMBERS, Member } from './members';

export function loadMembers(): Member[] {
  if (typeof window === 'undefined') return DEFAULT_MEMBERS;
  const stored = localStorage.getItem('members');
  if (!stored) return DEFAULT_MEMBERS;
  try { return JSON.parse(stored); } catch { return DEFAULT_MEMBERS; }
}

export function saveMembers(members: Member[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('members', JSON.stringify(members));
  }
}
