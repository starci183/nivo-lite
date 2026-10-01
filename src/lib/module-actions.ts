"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "@/i18n/server";
import { translator, type Locale } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { mergeSetupTurn, runSetupTurn } from "./module-setup-ai";
import {
  INSTALLATION_SELECT, toInstallation, toSession, toVersion, type InstallationRow,
} from "./modules-core";
import {
  MODULE_GATES, allGatesConfirmed, gateEntry, gateLabel, isModuleKey, snapshotOf,
  type ContextSnapshot, type ContextVersion, type GateEvidence, type Installation, type ModuleKey, type OperatingMode, type SetupMessage, type SetupRevision, type SetupSession,
} from "./modules-shared";
import { moduleCopy, moduleSpec } from "./modules";
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

type Db = Awaited<ReturnType<typeof supabaseServer>>;
type MessageRow = { id: string; setup_session_id: string; role: "user" | "assistant"; author: string; body: string; created_at: string };

const toMessage = (r: MessageRow): SetupMessage => ({ id: r.id, setupSessionId: r.setup_session_id, role: r.role, author: r.author, body: r.body, createdAt: r.created_at });
const fail = (error: { message: string } | null): void => { if (error) throw new Error(error.message); };
const refresh = () => revalidatePath("/", "layout");

const loadInstallation = async (db: Db, installationId: string): Promise<Installation> => {
  const { data, error } = await db.from("module_installations").select(INSTALLATION_SELECT).eq("id", installationId).maybeSingle();
  fail(error);
  if (!data) throw new Error("Not found");
  return toInstallation(data as unknown as InstallationRow);
};

const moduleName = (key: ModuleKey, locale: Locale): string => (translator(modulesCore, locale))(`${key}Name`);

const logEvent = (db: Db, ws: string, kind: string, actor: string, summary: string) =>
  db.from("events").insert({ workspace_id: ws, lead_id: null, kind, actor, summary, evidence: null });

/** The latest draft session of an installation, creating the first one (with NIVO's welcome) when there is none. */
const ensureDraftSession = async (db: Db, ws: string, installation: Installation, locale: Locale): Promise<SetupSession> => {
  const latest = await db.from("module_setup_sessions").select("*").eq("installation_id", installation.id).order("revision", { ascending: false }).limit(1).maybeSingle();
  fail(latest.error);
  if (latest.data && latest.data.status === "draft") return toSession(latest.data);
  const prev = latest.data ? toSession(latest.data) : null;
  const created = await db.from("module_setup_sessions").insert({
    workspace_id: ws, installation_id: installation.id, revision: (prev?.revision ?? 0) + 1,
    draft_snapshot: prev?.draft ?? { summary: "", facts: [] }, gate_evidence: prev?.gateEvidence ?? {},
  }).select().single();
  if (created.error) {
    // Lost a race with another tab: use the session it created.
    const again = await db.from("module_setup_sessions").select("*").eq("installation_id", installation.id).order("revision", { ascending: false }).limit(1).single();
    fail(again.error);
    return toSession(again.data);
  }
  const session = toSession(created.data);
  if (!prev) {
    const t = translator(moduleSetup, locale);
    await db.from("module_setup_messages").insert({
      workspace_id: ws, setup_session_id: session.id, role: "assistant", author: "NIVO",
      body: t("welcome", { module: moduleName(installation.moduleKey, locale) }),
    });
  }
  return session;
};

/* ------------------------------------------------------------------ catalogue */

/** Install a module: its installation, its agent (reused when the workspace already has one) and the first setup session. */
export const installModule = async (moduleKey: ModuleKey): Promise<Outcome<{ moduleKey: ModuleKey }>> =>
  run(async () => {
    if (!isModuleKey(moduleKey)) throw new Error("Unknown module");
    await requireManager();
    const session = await getSession();
    const db = await supabaseServer();
    const locale = await getLocale();
    const ws = session.workspace.id;

    const existing = await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", moduleKey).maybeSingle();
    fail(existing.error);
    let installationId = existing.data?.id as string | undefined;

    if (!installationId) {
      let agentId: string | null = null;
      const agent = await db.from("agents").select("id").eq("workspace_id", ws).eq("module", moduleKey).order("created_at").limit(1).maybeSingle();
      fail(agent.error);
      agentId = agent.data?.id ?? null;
      if (!agentId) {
        const spec = moduleSpec(moduleKey);
        const copy = moduleCopy(spec, locale);
        const created = await db.from("agents").insert({
          workspace_id: ws, module: moduleKey, name: `${spec.name} Agent`, handle: moduleKey, role: copy.defaultRole, instructions: copy.defaultInstructions,
        }).select("id").single();
        fail(created.error);
        agentId = created.data?.id ?? null;
      }
      const inserted = await db.from("module_installations").insert({ workspace_id: ws, module_key: moduleKey, agent_id: agentId, status: "setup" }).select("id").single();
      if (inserted.error) {
        const again = await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", moduleKey).single();
        fail(again.error);
        installationId = again.data?.id;
      } else {
        installationId = inserted.data.id;
        await logEvent(db, ws, "module.installed", session.userName, `${session.userName}: ${moduleName(moduleKey, locale)}`);
      }
    }
    const installation = await loadInstallation(db, installationId as string);
    await ensureDraftSession(db, ws, installation, locale);
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
    const row = await db.from("module_installations").select(INSTALLATION_SELECT).eq("workspace_id", session.workspace.id).eq("module_key", moduleKey).maybeSingle();
    fail(row.error);
    if (!row.data) throw new Error("Not found");
    const installation = toInstallation(row.data as unknown as InstallationRow);
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

    const turn = await runSetupTurn({
      moduleKey: installation.moduleKey, locale, draft: draftSession.draft, gates: draftSession.gateEvidence,
      history: history.map((m) => ({ role: m.role, body: m.body })), message: body,
    });
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
