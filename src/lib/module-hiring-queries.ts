import "server-only";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { isManagerRole } from "./members-shared";
import { ensureSettings, hdb, publicJobUrl, siteUrl } from "./module-hiring-core";
import type { CandidateRow, InterviewRow, JobRow, OfferRow, SettingsRow } from "./module-hiring-shared";

/** One person who can interview, with the weekly windows they said they are free (Vietnam time, minutes from midnight). */
export type MemberView = { readonly userId: string; readonly name: string; readonly role: string; readonly windows: ReadonlyArray<{ readonly weekday: number; readonly start_min: number; readonly end_min: number }> };
export type OnboardingRow = { id: string; candidate_id: string; title: string; done: boolean; done_at: string | null; sort: number };
export type HiringWorkbenchData = {
  readonly nowIso: string;
  readonly origin: string;
  readonly settings: SettingsRow | null;
  readonly jobs: ReadonlyArray<JobRow & { readonly publicUrl: string | null }>;
  readonly candidates: ReadonlyArray<CandidateRow>;
  readonly interviews: ReadonlyArray<InterviewRow>;
  readonly offers: ReadonlyArray<OfferRow>;
  readonly onboarding: ReadonlyArray<OnboardingRow>;
  readonly members: ReadonlyArray<MemberView>;
  readonly waitingApprovals: number;
  readonly meUserId: string;
};

/** The workbench data, read with the signed-in manager's own client (RLS decides what is visible). A non-manager gets `null`. */
export const getHiringWorkbench = async (): Promise<HiringWorkbenchData | null> => {
  const session = await getSession();
  if (!isManagerRole(session.member.role)) return null;
  const db = await supabaseServer();
  const ws = session.workspace.id;
  await ensureSettings(hdb(), ws);
  const [settings, jobs, cands, ivs, offers, onb, mem, av, waiting] = await Promise.all([
    db.from("hiring_settings").select("*").eq("workspace_id", ws).maybeSingle(),
    db.from("hiring_jobs").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }),
    db.from("hiring_candidates").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1000),
    db.from("hiring_interviews").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(300),
    db.from("hiring_offers").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(300),
    db.from("hiring_onboarding").select("id, candidate_id, title, done, done_at, sort").eq("workspace_id", ws).order("sort"),
    db.from("workspace_members").select("user_id, display_name, role, status").eq("workspace_id", ws).eq("status", "active").order("created_at"),
    db.from("hiring_availability").select("member_user_id, weekday, start_min, end_min").eq("workspace_id", ws),
    db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("department", "hiring").eq("status", "waiting_decision"),
  ]);
  const st = (settings.data ?? null) as SettingsRow | null;
  const avail = (av.data ?? []) as Array<{ member_user_id: string; weekday: number; start_min: number; end_min: number }>;
  return {
    nowIso: new Date().toISOString(),
    origin: siteUrl(),
    settings: st,
    jobs: ((jobs.data ?? []) as Array<JobRow>).map((j) => ({ ...j, publicUrl: st ? publicJobUrl(st.public_slug, j.slug) : null })),
    candidates: (cands.data ?? []) as Array<CandidateRow>,
    interviews: (ivs.data ?? []) as Array<InterviewRow>,
    offers: (offers.data ?? []) as Array<OfferRow>,
    onboarding: (onb.data ?? []) as Array<OnboardingRow>,
    members: ((mem.data ?? []) as Array<{ user_id: string; display_name: string; role: string }>).map((m) => ({
      userId: m.user_id, name: m.display_name, role: m.role,
      windows: avail.filter((a) => a.member_user_id === m.user_id).map(({ weekday, start_min, end_min }) => ({ weekday, start_min, end_min })),
    })),
    waitingApprovals: waiting.count ?? 0,
    meUserId: session.userId,
  };
};
