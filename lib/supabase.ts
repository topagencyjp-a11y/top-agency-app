import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function isValidUrl(s: string) {
  try { return /^https?:\/\//.test(new URL(s).href); } catch { return false; }
}

export const isSupabaseConfigured = () => Boolean(url && key && isValidUrl(url));

export const supabase = isSupabaseConfigured() ? createClient(url, key) : null;
