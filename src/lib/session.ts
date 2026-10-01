import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { getLocale } from "@/i18n/server";
import { seedWorkspace } from "./seed";
import { ensureFlowDefaults } from "./flow-seed";
import type { Workspace } from "./types";

export type Session = { userId: string; userName: string; email: string; avatarUrl: string | null; workspace: Workspace };

/** The signed-in user and their workspace (created and seeded on first visit). Redirects to /login otherwise. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  const userName = meta.full_name || meta.name || user.email?.split("@")[0] || "Owner";
  let { data: ws } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle<Workspace>();
  if (!ws) {
    const created = await supabase.from("workspaces").insert({ owner_id: user.id, name: "NIVO Workspace" }).select().single<Workspace>();
    if (created.error) throw new Error(created.error.message);
    ws = created.data;
    await seedWorkspace(supabase, ws.id, userName, await getLocale());
  }
  // Operating flow: authority + default rules (cheap check), and the simulated flow examples once per workspace.
  await ensureFlowDefaults(supabase, ws.id, userName, await getLocale());
  return { userId: user.id, userName, email: user.email ?? "", avatarUrl: meta.avatar_url ?? null, workspace: ws };
});
