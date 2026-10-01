import "server-only";
import { cache } from "react";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import {
  isModuleKey, type ContextSnapshot, type ContextVersion, type Installation, type InstallationStatus, type ModuleKey, type OperatingMode, type SetupSession,
} from "./modules-shared";

/** The module foundation contract. Types and the gate catalogue live in modules-shared.ts (client-safe) and are re-exported here. */
export * from "./modules-shared";

export type InstallationRow = {
  id: string; workspace_id: string; module_key: ModuleKey; agent_id: string | null; status: InstallationStatus; operating_mode: OperatingMode;
  live_enabled: boolean; active_context_version_id: string | null; settings: Record<string, unknown> | null; created_at: string;
  agent?: { name: string; handle: string } | null;
  active?: { version: number } | null;
};
type VersionRow = { id: string; installation_id: string; version: number; snapshot: ContextSnapshot; applied_by: string; applied_at: string };
type SessionRow = { id: string; installation_id: string; revision: number; status: SetupSession["status"]; draft_snapshot: SetupSession["draft"]; gate_evidence: SetupSession["gateEvidence"]; created_at: string };

export const INSTALLATION_SELECT = "*, agent:agents(name, handle), active:module_context_versions!module_installations_active_version_fk(version)";

export const toInstallation = (r: InstallationRow): Installation => ({
  id: r.id, workspaceId: r.workspace_id, moduleKey: r.module_key, agentId: r.agent_id,
  agentName: r.agent?.name ?? "", agentHandle: r.agent?.handle ?? r.module_key,
  status: r.status, operatingMode: r.operating_mode, liveEnabled: r.live_enabled,
  activeContextVersionId: r.active_context_version_id, activeVersion: r.active?.version ?? null,
  settings: r.settings ?? {}, createdAt: r.created_at,
});
export const toVersion = (r: VersionRow): ContextVersion => ({
  id: r.id, installationId: r.installation_id, version: r.version, snapshot: r.snapshot, appliedBy: r.applied_by, appliedAt: r.applied_at,
});
export const toSession = (r: SessionRow): SetupSession => ({
  id: r.id, installationId: r.installation_id, revision: r.revision, status: r.status,
  draft: r.draft_snapshot ?? { summary: "", facts: [] }, gateEvidence: r.gate_evidence ?? {}, createdAt: r.created_at,
});

/** Every installed module of the signed-in workspace (the three modules at most). */
export const listInstallations = cache(async (): Promise<Array<Installation>> => {
  const session = await getSession();
  const db = await supabaseServer();
  const { data, error } = await db.from("module_installations").select(INSTALLATION_SELECT).eq("workspace_id", session.workspace.id).order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<InstallationRow>).map(toInstallation);
});

/** One module's installation in the signed-in workspace, null when it is not installed. */
export const getInstallation = async (moduleKey: ModuleKey): Promise<Installation | null> => {
  if (!isModuleKey(moduleKey)) return null;
  return (await listInstallations()).find((i) => i.moduleKey === moduleKey) ?? null;
};

/** The context version in use for a module (what its agent runs on), null when none has been applied. */
export const getActiveContext = async (moduleKey: ModuleKey): Promise<ContextVersion | null> => {
  const installation = await getInstallation(moduleKey);
  if (!installation?.activeContextVersionId) return null;
  const db = await supabaseServer();
  const { data } = await db.from("module_context_versions").select("*").eq("id", installation.activeContextVersionId).maybeSingle<VersionRow>();
  return data ? toVersion(data) : null;
};

/** All applied versions of a module, newest first. */
export const listContextVersions = async (installationId: string): Promise<Array<ContextVersion>> => {
  const db = await supabaseServer();
  const { data, error } = await db.from("module_context_versions").select("*").eq("installation_id", installationId).order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<VersionRow>).map(toVersion);
};
