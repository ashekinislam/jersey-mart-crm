import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Bypasses RLS via the service-role key. Only ever import this from the
 * Meta webhook route — there is no user session to scope requests by there.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
