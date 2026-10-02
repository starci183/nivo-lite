"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "@/i18n/server";
import { translator, type Locale } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { enqueueAgentSync } from "./engine-queue";
import { mergeSetupTurn, runSetupTurn } from "./module-setup-ai";
import { withUsage } from "./usage";
import {
  INSTALLATION_SELECT, getInstallation, toInstallation, toSession, toVersion, type InstallationRow,
} from "./modules-core";
import {
  MODULE_GATES, allGatesConfirmed, gateEntry, gateLabel, isModuleKey, snapshotOf,
  type ContextSnapshot, type ContextVersion, type GateEvidence, type Installation, type ModuleKey, type OperatingMode, type SetupMessage, type SetupRevision, type SetupSession,
} from "./modules-shared";
import { ensureDraftSession, fail, installModuleCore, loadInstallation, logEvent, moduleName, type Db } from "./module-install";
import { requireManager } from "./permissions";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { Outcome } from "./types";

/* ------------------------------------------------------------------ helpers */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

type SessionRowShape = Parameters<typeof toSession>[0];
type MessageRow = { id: string; setup_session_id: string; role: "user" | "assistant"; author: string; body: string; created_at: string };

const toMessage = (r: MessageRow): SetupMessage => ({ id: r.id, setupSessionId: r.setup_session_id, role: r.role, author: r.author, body: r.body, createdAt: r.created_at });
const refresh = () => revalidatePath("/", "layout");

/* ------------------------------------------------------------------ catalogue */

/** Install a module: its installation, its agent (reused when the workspace already has one), its default authority rules, the first setup session and the OpenClaw sync. Any module of the registry. */
export const installModule = async (moduleKey: ModuleKey): Promise<Outcome<{ moduleKey: ModuleKey }>> =>
  run(async () => {
    if (!isModuleKey(moduleKey)) throw new Error("Unknown module");
    await requireManager();
    const session = await getSession();
    const db = await supabaseServer();
    await installModuleCore(db, { workspaceId: session.workspace.id, moduleKey, locale: await getLocale(), actorName: session.userName });
    refresh();
    return { moduleKey };
  });

/* ------------------------------------------------------------------ setup chat */

export type SetupState = {
  installation: Installation;
  /** The current draft session: new messages go here and realtime follows it. */
  session: SetupSession;
  /** Every earlier and current revision of this installation, oldest first (for the history dividers). */
  revisions: Array<SetupRevision>;
  /** The whole chat across every revision, oldest first. */
  messages: Array<SetupMessage>;
};

/** Everything the Setup tab needs: the draft session (created on first open) and the full chat history of the installation. */
export const loadSetup = async (moduleKey: ModuleKey): Promise<Outcome<SetupState>> =>
  run(async () => {
    await requireManager();
    const session = await getSession();
    const db = await supabaseServer();
    // The installation list is cached for the request (the module layout reads it too), so this costs no request of its own.
    const installation = await getInstallation(moduleKey);
    if (!installation) throw new Error("Not found");
    // Sessions and the whole chat in ONE wave (the chat is filtered through its session's installation), instead of 4 sequential reads.
    const [sessionRows, chatRows] = await Promise.all([
      db.from("module_setup_sessions").select("*").eq("installation_id", installation.id).order("revision"),
      db.from("module_setup_messages").select("*, session:module_setup_sessions!inner(installation_id)").eq("session.installation_id", installation.id).order("created_at"),
    ]);
    fail(sessionRows.error);
    fail(chatRows.error);
    const rows = (sessionRows.data ?? []) as Array<SessionRowShape>;
    const latest = rows.at(-1) ?? null;
    if (latest && latest.status === "draft") {
      const messages = ((chatRows.data ?? []) as unknown as Array<MessageRow & { session?: unknown }>).map(({ session: _s, ...m }) => toMessage(m));
      return { installation, session: toSession(latest), revisions: rows.map((r) => ({ id: r.id, revision: r.revision, status: r.status })) as Array<SetupRevision>, messages };
    }
    // No open draft yet (first visit, or the last revision was applied): create it, then read again.
    const draft = await ensureDraftSession(db, session.workspace.id, installation, await getLocale());
    const sessions = await db.from("module_setup_sessions").select("id, revision, status").eq("installation_id", installation.id).order("revision");
    fail(sessions.error);
    const revisions = (sessions.data ?? []) as Array<SetupRevision>;
    return { installation, session: draft, revisions, messages: await listInstallationMessages(db, revisions.map((r) => r.id)) };
  });

/** The chat of several revisions at once, oldest first (RLS keeps it owner/manager-only). */
const listInstallationMessages = async (db: Db, sessionIds: ReadonlyArray<string>): Promise<Array<SetupMessage>> => {
  if (sessionIds.length === 0) return [];
  const { data, error } = await db.from("module_setup_messages").select("*").in("setup_session_id", [...sessionIds]).order("created_at");
  fail(error);
  return ((data ?? []) as Array<MessageRow>).map(toMessage);
};

const listSetupMessages = async (db: Db, sessionId: string): Promise<Array<SetupMessage>> => {
  const { data, error } = await db.from("module_setup_messages").select("*").eq("setup_session_id", sessionId).order("created_at");
  fail(error);
  return ((data ?? []) as Array<MessageRow>).map(toMessage);
};

/** Messages of a setup session (initial load and refresh). */
export const listSetupChat = async (setupSessionId: string): Promise<Outcome<Array<SetupMessage>>> =>
  run(async () => {
    await requireManager();
    return listSetupMessages(await supabaseServer(), setupSessionId);
  });

/** One owner message: ONE model call, merged into the draft; NIVO's reply is stored as the next chat message. */
export const sendSetupMessage = async (setupSessionId: string, text: string): Promise<Outcome<{ session: SetupSession; messages: Array<SetupMessage> }>> =>
  run(async () => {
    const member = await requireManager();
    const body = text.trim().slice(0, 4000);
    if (!body) throw new Error("Empty message");
    const ctxSession = await getSession();
    const db = await supabaseServer();
    const locale = await getLocale();
    const ws = ctxSession.workspace.id;

    const sessionRow = await db.from("module_setup_sessions").select("*").eq("id", setupSessionId).maybeSingle();
    fail(sessionRow.error);
    if (!sessionRow.data || sessionRow.data.status !== "draft") throw new Error("Not found");
    const draftSession = toSession(sessionRow.data);
    const installation = await loadInstallation(db, draftSession.installationId);
    const history = await listSetupMessages(db, setupSessionId);

    const inserted = await db.from("module_setup_messages").insert({ workspace_id: ws, setup_session_id: setupSessionId, role: "user", author: member.displayName, body });
    fail(inserted.error);

    const turn = await withUsage({ workspaceId: ws }, () => runSetupTurn({
      moduleKey: installation.moduleKey, locale, draft: draftSession.draft, gates: draftSession.gateEvidence,
      history: history.map((m) => ({ role: m.role, body: m.body })), message: body,
    }));
    const merged = mergeSetupTurn(draftSession.draft, draftSession.gateEvidence, turn);
    const updated = await db.from("module_setup_sessions").update({ draft_snapshot: merged.draft, gate_evidence: merged.gates }).eq("id", setupSessionId).select().single();
    fail(updated.error);
    const reply = await db.from("module_setup_messages").insert({ workspace_id: ws, setup_session_id: setupSessionId, role: "assistant", author: "NIVO", body: turn.reply });
    fail(reply.error);
    return { session: toSession(updated.data), messages: await listSetupMessages(db, setupSessionId) };
  });

/** Confirm, reopen or edit one gate of the draft. Editing sets the owner's own wording and confirms it. */
export const setGate = async (
  setupSessionId: string, gateKey: string, change: { action: "confirm" | "reopen" | "edit"; evidence?: string },
): Promise<Outcome<SetupSession>> =>
  run(async () => {
    const member = await requireManager();
    const db = await supabaseServer();
    const row = await db.from("module_setup_sessions").select("*").eq("id", setupSessionId).maybeSingle();
    fail(row.error);
    if (!row.data || row.data.status !== "draft") throw new Error("Not found");
    const session = toSession(row.data);
    const installation = await loadInstallation(db, session.installationId);
    if (!MODULE_GATES[installation.moduleKey].some((g) => g.key === gateKey)) throw new Error("Unknown gate");
    const current = gateEntry(session.gateEvidence, gateKey);
    const evidence = change.action === "edit" ? (change.evidence ?? "").trim().slice(0, 800) : current.evidence;
    if (change.action !== "reopen" && !evidence) throw new Error("Nothing to confirm yet");
    const gates: GateEvidence = {
      ...session.gateEvidence,
      [gateKey]: change.action === "reopen"
        ? { status: "proposed", evidence }
        : { status: "confirmed", evidence, confirmed_by: member.displayName, confirmed_at: new Date().toISOString() },
    };
    const updated = await db.from("module_setup_sessions").update({ gate_evidence: gates }).eq("id", setupSessionId).select().single();
    fail(updated.error);
    return toSession(updated.data);
  });

/* ------------------------------------------------------------------ apply */

const BLOCK_START = "### NIVO setup";
const BLOCK_END = "### end NIVO setup";
const stripBlock = (text: string): string => text.replace(/\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/g, "").trimEnd();

/** The text written into the agent: behaviour rules into `instructions`, business knowledge into `knowledge`. */
const agentTexts = (moduleKey: ModuleKey, snapshot: ContextSnapshot, version: number, locale: Locale) => {
  const gates = MODULE_GATES[moduleKey];
  const rules = gates.map((g) => `- ${gateLabel(g, locale)}: ${gateEntry(snapshot.gates, g.key).evidence}`).join("\n");
  const facts = snapshot.facts.map((f) => `- ${f.text}`).join("\n");
  const instructions = `${BLOCK_START} v${version}\nConfirmed by the owner. Follow these rules exactly; when something is not covered, say a team member will confirm.\n${rules}\n${BLOCK_END}`;
  const knowledge = `${BLOCK_START} v${version}\n${snapshot.summary}\n${facts}\n${rules}\n${BLOCK_END}`;
  return { instructions, knowledge };
};

/** Apply the draft: a new immutable context version becomes the one in use, and the module's agent runs on it right away. */
export const applySetup = async (installationId: string): Promise<Outcome<{ version: number }>> =>
  run(async () => {
    const member = await requireManager();
    const ctxSession = await getSession();
    const db = await supabaseServer();
    const locale = await getLocale();
    const ws = ctxSession.workspace.id;
    const t = translator(moduleSetup, locale);

    const installation = await loadInstallation(db, installationId);
    const draft = await ensureDraftSession(db, ws, installation, locale);
    if (!allGatesConfirmed(installation.moduleKey, draft.gateEvidence)) throw new Error(t("applyHint"));
    const snapshot = snapshotOf(draft.draft, draft.gateEvidence);

    const latest = await db.from("module_context_versions").select("*").eq("installation_id", installationId).order("version", { ascending: false }).limit(1).maybeSingle();
    fail(latest.error);
    const last: ContextVersion | null = latest.data ? toVersion(latest.data) : null;
    if (last && installation.activeContextVersionId === last.id && JSON.stringify(last.snapshot) === JSON.stringify(snapshot)) throw new Error(t("applyUnchanged"));
    const version = (last?.version ?? 0) + 1;

    const created = await db.from("module_context_versions").insert({
      workspace_id: ws, installation_id: installationId, version, snapshot, applied_by: member.displayName,
    }).select().single();
    fail(created.error);

    // Notes proposed from Office are part of this version now.
    await db.from("module_context_notes").update({ status: "applied", applied_version: version, decided_by: member.displayName, decided_at: new Date().toISOString() }).eq("installation_id", installationId).eq("status", "pending");

    const nextStatus = installation.status === "installing" || installation.status === "setup" ? "ready" : installation.status;
    const upd = await db.from("module_installations").update({ active_context_version_id: created.data.id, status: nextStatus }).eq("id", installationId);
    fail(upd.error);

    if (installation.agentId) {
      const agent = await db.from("agents").select("instructions, knowledge").eq("id", installation.agentId).single();
      fail(agent.error);
      const texts = agentTexts(installation.moduleKey, snapshot, version, locale);
      const agentUpd = await db.from("agents").update({
        instructions: `${stripBlock(agent.data?.instructions ?? "")}\n\n${texts.instructions}`.trim(),
        knowledge: `${stripBlock(agent.data?.knowledge ?? "")}\n\n${texts.knowledge}`.trim(),
      }).eq("id", installation.agentId);
      fail(agentUpd.error);
    }

    const closed = await db.from("module_setup_sessions").update({ status: "applied" }).eq("id", draft.id);
    fail(closed.error);
    await ensureDraftSession(db, ws, installation, locale);
    await logEvent(db, ws, "module.context_applied", member.displayName, `${moduleName(installation.moduleKey, locale)} v${version}`);
    // The agent's OpenClaw copy (AGENTS.md, SOUL.md, knowledge/) follows the new active version (no-op unless the module runs on OpenClaw).
    await enqueueAgentSync(installationId);
    refresh();
    return { version };
  });

/* ------------------------------------------------------------------ settings */

/** Rename the module's agent (the display name). */
export const renameModule = async (installationId: string, name: string): Promise<Outcome<Installation>> =>
  run(async () => {
    await requireManager();
    const db = await supabaseServer();
    const clean = name.trim().slice(0, 40);
    if (clean.length < 2) throw new Error("Name too short");
    const installation = await loadInstallation(db, installationId);
    if (!installation.agentId) throw new Error("Not found");
    const upd = await db.from("agents").update({ name: clean }).eq("id", installation.agentId);
    fail(upd.error);
    await enqueueAgentSync(installationId);
    refresh();
    return loadInstallation(db, installationId);
  });

/** Operating mode: autopilot applies the Authority rules as configured; assist is a gate in the engine that downgrades "auto" to "ask" (rules are never rewritten). */
export const setOperatingMode = async (installationId: string, mode: OperatingMode): Promise<Outcome<Installation>> =>
  run(async () => {
    await requireManager();
    if (mode !== "assist" && mode !== "autopilot") throw new Error("Invalid mode");
    const session = await getSession();
    const db = await supabaseServer();
    const installation = await loadInstallation(db, installationId);
    const upd = await db.from("module_installations").update({ operating_mode: mode }).eq("id", installationId);
    fail(upd.error);
    refresh();
    return loadInstallation(db, installationId);
  });

/** Live on/off: live = the agent acts on channels; paused = it stays silent. Going live needs an applied version. */
export const setModuleLive = async (installationId: string, on: boolean): Promise<Outcome<Installation>> =>
  run(async () => {
    await requireManager();
    const db = await supabaseServer();
    const installation = await loadInstallation(db, installationId);
    if (on && !installation.activeContextVersionId) throw new Error((translator(modulesCore, await getLocale()))("liveNeedsVersion"));
    const upd = await db.from("module_installations").update({ live_enabled: on, status: on ? "live" : "paused" }).eq("id", installationId);
    fail(upd.error);
    if (installation.agentId) {
      const agentUpd = await db.from("agents").update({ status: on ? "active" : "paused" }).eq("id", installation.agentId);
      fail(agentUpd.error);
    }
    refresh();
    return loadInstallation(db, installationId);
  });
