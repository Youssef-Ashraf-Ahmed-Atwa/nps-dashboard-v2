import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service role key.
 * Returns null when the environment variables are not set yet, so the app
 * keeps working (analysis only) and the save buttons explain what is missing.
 * Never import this file from a "use client" component.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const NOT_CONFIGURED_MESSAGE =
  "قاعدة البيانات غير مربوطة بعد. أضف SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY في ملف .env.local ثم أعد تشغيل السيرفر.";
