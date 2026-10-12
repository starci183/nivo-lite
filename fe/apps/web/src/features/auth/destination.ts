import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_NEXT, safeNext } from "./next";

/** Where an onboarding-less person goes after authenticating: they must pick a plan and pay for a workspace first. */
export const ONBOARDING_PATH = "/workspaces";

/**
 * The page to open right after a session was created. An explicit `next` (an invite page, a deep link) always wins.
 * Otherwise: people with an active membership go to the dashboard; people with none are sent to /workspaces
 * (a workspace is never created implicitly). A failed lookup falls back to the dashboard, which gates by itself.
 */
export const postAuthPath = async (supabase: SupabaseClient, rawNext: string | null | undefined, origin?: string): Promise<string> => {
  const next = safeNext(rawNext, origin);
  if (next !== DEFAULT_NEXT) return next;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return DEFAULT_NEXT;
  const { data, error } = await supabase.from("workspace_members").select("status").eq("user_id", user.user.id);
  if (error) return DEFAULT_NEXT;
  const hasActive = (data ?? []).some((row: { status: string }) => row.status === "active");
  const hasAny = (data ?? []).length > 0;
  return hasActive || hasAny ? DEFAULT_NEXT : ONBOARDING_PATH;
};
