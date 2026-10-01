"use server";

import { revalidatePath } from "next/cache";
import type { ContextNote } from "./context-notes";
import { applySetup } from "./module-actions";
import { toSession } from "./modules-core";
import { requireManager } from "./permissions";
import { knowledgeCounts } from "./knowledge/index";
import type { ModuleKey } from "./modules-shared";
import { supabaseServer } from "./supabase/server";
import type { Outcome } from "./types";

type Row = {
  id: string; installation_id: string; body: string; source: "office" | "setup"; author_name: string; author_role: ContextNote["authorRole"];
  status: ContextNote["status"]; created_at: string; fact_key: string;
};
const toNote = (r: Row): ContextNote => ({
  id: r.id, installationId: r.installation_id, body: r.body, source: r.source, authorName: r.author_name, authorRole: r.author_role, status: r.status, createdAt: r.created_at,
});

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
};

/** Notes from Office waiting for approval on one installation (owner and manager). */
export const listPendingNotes = async (installationId: string): Promise<Outcome<Array<ContextNote>>> =>
  run(async () => {
    await requireManager();
    const db = await supabaseServer();
    const { data, error } = await db.from("module_context_notes").select("*").eq("installation_id", installationId).eq("status", "pending").order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Row>).map(toNote);
  });

/** Dismiss a note: it leaves the list and its fact leaves the current draft. */
export const dismissNote = async (noteId: string): Promise<Outcome<null>> =>
  run(async () => {
    const member = await requireManager();
    const db = await supabaseServer();
    const { data, error } = await db.from("module_context_notes")
      .update({ status: "dismissed", decided_by: member.displayName, decided_at: new Date().toISOString() })
      .eq("id", noteId).eq("status", "pending").select().maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const row = data as Row;
      const latest = await db.from("module_setup_sessions").select("*").eq("installation_id", row.installation_id).eq("status", "draft").order("revision", { ascending: false }).limit(1).maybeSingle();
      if (latest.data) {
        const s = toSession(latest.data);
        await db.from("module_setup_sessions").update({ draft_snapshot: { ...s.draft, facts: s.draft.facts.filter((f) => f.key !== row.fact_key) } }).eq("id", s.id);
      }
    }
    revalidatePath("/", "layout");
    return null;
  });

/** "Duyệt & áp dụng": apply the current draft (it holds the note) as the next context version. Every setup gate must be confirmed. */
export const approveNoteAndApply = async (installationId: string): Promise<Outcome<{ version: number }>> =>
  run(async () => {
    await requireManager();
    const r = await applySetup(installationId);
    if (!r.ok) throw new Error(r.error);
    return r.data;
  });

/** Counts for the Setup card "Tri thức dùng cho module". */
export const loadKnowledgeCounts = async (moduleKey: ModuleKey): Promise<Outcome<{ nivo: number; business: number; publicSources: number }>> =>
  run(async () => knowledgeCounts(moduleKey));
