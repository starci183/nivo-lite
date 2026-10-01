import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "../config";

/**
 * Service-role client: bypasses RLS. Server-only, for the few things a signed-in user may not do for themselves
 * (create an invited account, read auth metadata). Never pass user input into a query without scoping it yourself.
 */
export const supabaseAdmin = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY (see secrets.example.env)");
  return createClient(publicConfig.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
};
