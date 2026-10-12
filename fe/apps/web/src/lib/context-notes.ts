import "server-only";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import type { ModuleKey, SetupSession } from "./modules-shared";
import { toSession } from "./modules-core";
import { supabaseAdmin } from "./supabase/admin";
import type { Role } from "./members-shared";

/**
 * Supplementing a module's context later. A note ("@Chatbot ghi nhớ: từ tháng 11 combo thư giãn tăng lên 650k") from Office
 * becomes a PROPOSED fact in the installation's current draft setup session, with its author and source. Nothing reaches the
 * agent until an owner or manager applies the draft (the next immutable context version).
 */

export type ContextNote = {
  id: string; installationId: string; body: string; source: "office" | "setup"; authorName: string; authorRole: Role;
  status: "pending" | "applied" | "dismissed"; createdAt: string;
};

const LEAD = /(ghi nhớ|ghi nho|lưu ý|luu y|từ nay|tu nay|bổ sung|bo sung|cập nhật|cap nhat|nhớ rằng|nho rang|remember|note that|note|from now on|please note)\s*[:,\-–]?\s*/iu;

/** The note text when a message addressed to an agent is a note or standing instruction (ghi nhớ, lưu ý, từ nay, bổ sung...), else null. */
export const noteIntent = (body: string): string | null => {
  const text = body.replace(/@[a-z0-9-]+/gi, " ").replace(/\s+/g, " ").trim();
  const m = text.match(LEAD);
  if (!m || m.index === undefined) return null;
  // The keyword must open the message (after mentions): a question that merely contains "lưu ý" is not a note.
  if (text.slice(0, m.index).trim().length > 0) return null;
  // "từ nay" / "from now on" is part of the instruction itself: keep it.
  const keep = /^(từ nay|tu nay|from now on)$/i.test(m[1] ?? "");
  const note = keep ? text : text.slice(m.index + m[0].length).trim();
  return note.length >= 6 ? note.slice(0, 600) : null;
};

type Admin = ReturnType<typeof supabaseAdmin>;

const draftSessionOf = async (db: Admin, workspaceId: string, installationId: string): Promise<SetupSession> => {
  const latest = await db.from("module_setup_sessions").select("*").eq("installation_id", installationId).order("revision", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw new Error(latest.error.message);
  if (latest.data && latest.data.status === "draft") return toSession(latest.data);
  const prev = latest.data ? toSession(latest.data) : null;
  const created = await db.from("module_setup_sessions").insert({
    workspace_id: workspaceId, installation_id: installationId, revision: (prev?.revision ?? 0) + 1,
    draft_snapshot: prev?.draft ?? { summary: "", facts: [] }, gate_evidence: prev?.gateEvidence ?? {},
  }).select().single();
  if (created.error) throw new Error(created.error.message);
  return toSession(created.data);
};

export type ProposedNote = { noteId: string; moduleKey: ModuleKey; installationId: string };

/** Record a note from Office as a proposal on the module the agent belongs to. Null when the agent is not a module agent. */
export const proposeContextNote = async (a: {
  workspaceId: string; agentId: string; text: string; author: { userId: string; name: string; role: Role }; locale: "vi" | "en";
}): Promise<ProposedNote | null> => {
  const db = supabaseAdmin();
  const inst = await db.from("module_installations").select("id, module_key").eq("workspace_id", a.workspaceId).eq("agent_id", a.agentId).maybeSingle();
  if (inst.error || !inst.data) return null;
  const installationId = inst.data.id as string;
  const when = new Intl.DateTimeFormat(intlLocale(a.locale), { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date());
  const session = await draftSessionOf(db, a.workspaceId, installationId);

  const noteId = crypto.randomUUID();
  const factKey = `note_${noteId.slice(0, 8)}`;
  const ins = await db.from("module_context_notes").insert({
    id: noteId, workspace_id: a.workspaceId, installation_id: installationId, fact_key: factKey, body: a.text, source: "office",
    author_name: a.author.name, author_role: a.author.role, author_user_id: a.author.userId,
  });
  if (ins.error) throw new Error(ins.error.message);
  const facts = [...session.draft.facts, { key: factKey, text: `${a.text} (Office · ${a.author.name} · ${when})` }].slice(-60);
  const upd = await db.from("module_setup_sessions").update({ draft_snapshot: { ...session.draft, facts } }).eq("id", session.id);
  if (upd.error) throw new Error(upd.error.message);
  return { noteId, moduleKey: inst.data.module_key as ModuleKey, installationId };
};
