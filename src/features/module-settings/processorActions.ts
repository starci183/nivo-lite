"use server";

import { revalidatePath } from "next/cache";
import { enqueueAgentSync, processorFromSettings, type Processor } from "@/lib/engine-queue";
import { requireManager } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";

export type EngineStatus = { readonly online: boolean; readonly lastHeartbeat: string | null };

/** Choose who answers this module's customers. Owner or manager only; merges into the installation's settings (jsonb). */
export const setProcessor = async (installationId: string, processor: Processor): Promise<Outcome<{ processor: Processor }>> => {
  try {
    await requireManager();
    if (processor !== "nivo" && processor !== "openclaw") throw new Error("Invalid processor");
    const db = await supabaseServer();
    const { data, error } = await db.from("module_installations").select("settings").eq("id", installationId).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Not found");
    const settings = { ...((data as { settings: Record<string, unknown> | null }).settings ?? {}), processor };
    const upd = await db.from("module_installations").update({ settings }).eq("id", installationId);
    if (upd.error) throw new Error(upd.error.message);
    // Switched to OpenClaw: build its copy of the agent now (the engine also keeps it current every 5 minutes).
    if (processor === "openclaw") await enqueueAgentSync(installationId);
    revalidatePath("/", "layout");
    return { ok: true, data: { processor: processorFromSettings(settings) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** The engine's last heartbeat, through engine_status() (the workers table itself is not readable by clients). */
export const getEngineStatus = async (): Promise<Outcome<EngineStatus>> => {
  try {
    await requireManager();
    const db = await supabaseServer();
    const { data, error } = await db.rpc("engine_status");
    if (error) throw new Error(error.message);
    const row = ((data ?? []) as Array<{ last_heartbeat_at: string | null; online: boolean }>)[0];
    return { ok: true, data: { online: row?.online === true, lastHeartbeat: row?.last_heartbeat_at ?? null } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export type AgentSyncState = "none" | "syncing" | "ok" | "error";
export type AgentSyncStatus = {
  readonly state: AgentSyncState;
  /** The context version OpenClaw holds (null = none applied yet / no copy) and the one Supabase has active. */
  readonly syncedVersion: number | null;
  readonly activeVersion: number | null;
  readonly checkedAt: string | null;
  readonly error: string | null;
  readonly fileCount: number;
};

/** What the Processor card shows: the OpenClaw copy of this module's agent against what Supabase says is active, and whether a sync is queued or running. */
export const getAgentSyncStatus = async (installationId: string): Promise<Outcome<AgentSyncStatus>> => {
  try {
    await requireManager();
    const db = await supabaseServer();
    const inst = await db.from("module_installations").select("active_context_version_id").eq("id", installationId).maybeSingle();
    if (inst.error || !inst.data) throw new Error(inst.error?.message ?? "Not found");
    const versionId = (inst.data as { active_context_version_id: string | null }).active_context_version_id;
    const active = versionId ? ((await db.from("module_context_versions").select("version").eq("id", versionId).maybeSingle()).data as { version: number } | null)?.version ?? null : null;
    const row = (await db.from("openclaw_agent_sync").select("status, context_version, checked_at, error, files").eq("installation_id", installationId).maybeSingle()).data as
      { status: "ok" | "error"; context_version: number | null; checked_at: string; error: string | null; files: Array<unknown> } | null;
    const pending = await db.from("engine_jobs").select("id", { count: "exact", head: true }).eq("kind", "openclaw.sync_agent").eq("payload->>installation_id", installationId).in("status", ["queued", "running"]);
    const syncing = (pending.count ?? 0) > 0;
    return {
      ok: true,
      data: {
        state: syncing ? "syncing" : row === null ? "none" : row.status,
        syncedVersion: row?.context_version ?? null, activeVersion: active, checkedAt: row?.checked_at ?? null, error: row?.error ?? null, fileCount: row?.files.length ?? 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** "Đồng bộ lại": queue a sync now (also for a module that is not on OpenClaw yet). The card then polls getAgentSyncStatus. */
export const resyncAgent = async (installationId: string): Promise<Outcome<{ queued: boolean }>> => {
  try {
    await requireManager();
    const db = await supabaseServer();
    const inst = await db.from("module_installations").select("id").eq("id", installationId).maybeSingle(); // RLS: only this workspace's installations
    if (inst.error || !inst.data) throw new Error(inst.error?.message ?? "Not found");
    return { ok: true, data: { queued: await enqueueAgentSync(installationId, { force: true }) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
