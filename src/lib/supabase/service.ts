import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Bypasses RLS via the service-role key. Only import this where there is no user
 * session to scope requests by -- webhooks, cron jobs, and the public tracking page
 * (whose visitor never logs in). Every caller must apply its own narrow, explicit
 * column selection, since there is no RLS left to catch an accidental overfetch.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
