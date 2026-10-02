import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { translator, type Locale } from "@/i18n/core";
import { moduleSetup } from "@/i18n/dict/moduleSetup";
import { enqueueAgentSync } from "./engine-queue";
import { moduleDef, moduleName as registryModuleName } from "./module-registry";
import { INSTALLATION_SELECT, toInstallation, toSession, type InstallationRow } from "./modules-core";
import { moduleCopy, moduleSpec } from "./modules";
import type { Installation, ModuleKey, SetupSession } from "./modules-shared";
import { defaultRulesOf } from "./policy";

/** Install and setup-session core, shared by the server action (user session) and by service-role verification code. */
export type Db = SupabaseClient;

export const fail = (error: { message: string } | null): void => { if (error) throw new Error(error.message); };

export const moduleName = (key: ModuleKey, locale: Locale): string => registryModuleName(key, locale);

export const logEvent = (db: Db, ws: string, kind: string, actor: string, summary: string) =>
  db.from("events").insert({ workspace_id: ws, lead_id: null, kind, actor, summary, evidence: null });

export const loadInstallation = async (db: Db, installationId: string): Promise<Installation> => {
  const { data, error } = await db.from("module_installations").select(INSTALLATION_SELECT).eq("id", installationId).maybeSingle();
  fail(error);
  if (!data) throw new Error("Not found");
  return toInstallation(data as unknown as InstallationRow);
};

/** The latest draft session of an installation, creating the first one (with NIVO's welcome) when there is none. */
export const ensureDraftSession = async (db: Db, ws: string, installation: Installation, locale: Locale): Promise<SetupSession> => {
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

export type InstallResult = { readonly installationId: string; readonly agentId: string | null; readonly created: boolean; readonly sessionId: string; readonly syncQueued: boolean };

/**
 * Install a registry module in a workspace: its agent (reused when the workspace already has one), the installation, its default authority
 * rules (never overwriting what the owner already set), the first setup session and a queued OpenClaw sync of the agent's copy
 * (base knowledge + gates). Idempotent. Works for every module of the registry.
 */
export const installModuleCore = async (db: Db, input: { workspaceId: string; moduleKey: ModuleKey; locale: Locale; actorName: string }): Promise<InstallResult> => {
  const { workspaceId: ws, moduleKey, locale, actorName } = input;
  const def = moduleDef(moduleKey);
  const existing = await db.from("module_installations").select("id, agent_id").eq("workspace_id", ws).eq("module_key", moduleKey).maybeSingle();
  fail(existing.error);
  let installationId = existing.data?.id as string | undefined;
  let created = false;

  if (!installationId) {
    const agent = await db.from("agents").select("id").eq("workspace_id", ws).eq("module", moduleKey).order("created_at").limit(1).maybeSingle();
    fail(agent.error);
    let agentId = (agent.data?.id as string | undefined) ?? null;
    if (!agentId) {
      const copy = moduleCopy(moduleSpec(moduleKey), locale);
      const made = await db.from("agents").insert({
        workspace_id: ws, module: moduleKey, name: def.agent.name, handle: def.agent.handle, role: copy.defaultRole, instructions: copy.defaultInstructions,
      }).select("id").single();
      fail(made.error);
      agentId = (made.data?.id as string | undefined) ?? null;
    }
    const inserted = await db.from("module_installations").insert({
      workspace_id: ws, module_key: moduleKey, agent_id: agentId, status: "setup", operating_mode: def.defaultOperatingMode,
    }).select("id").single();
    if (inserted.error) {
      const again = await db.from("module_installations").select("id").eq("workspace_id", ws).eq("module_key", moduleKey).single();
      fail(again.error);
      installationId = again.data?.id as string;
    } else {
      installationId = inserted.data.id as string;
      created = true;
      await logEvent(db, ws, "module.installed", actorName, `${actorName}: ${moduleName(moduleKey, locale)}`);
    }
  }

  // The module's default authority rules: only the missing ones are added, so an owner's choices are never reset.
  const rules = defaultRulesOf(moduleKey);
  if (rules.length) {
    const up = await db.from("authority_rules").upsert(rules.map((r) => ({ workspace_id: ws, ...r })), { onConflict: "workspace_id,department,action", ignoreDuplicates: true });
    fail(up.error);
  }

  const installation = await loadInstallation(db, installationId as string);
  const session = await ensureDraftSession(db, ws, installation, locale);
  // OpenClaw gets the agent's copy right away (base knowledge + the module's gates); the setup chat itself already runs through openclaw.generate.
  const syncQueued = await enqueueAgentSync(installation.id, { force: true }).catch(() => false);
  return { installationId: installation.id, agentId: installation.agentId, created, sessionId: session.id, syncQueued };
};
