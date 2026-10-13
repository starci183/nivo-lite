"use server";

import { revalidatePath } from "next/cache";
import { isAccess } from "./connection-access";
import { setGrant } from "./connection-actions";
import { enqueueAgentSync } from "./engine-queue";
import { requireManager } from "./permissions";
import { dbFailure, dbOk, readAgentSync, readInstallation, writeInstallationSettings, type AgentSyncStatus, type DbOutcome } from "@/modules/db";

/**
 * The server actions of the settings extras and the sync card of an agent. The database is reached only through modules/db; what stays
 * here is who may act, the sync queue and the revalidation.
 */

const guarded = async <T>(fn: () => Promise<DbOutcome<T>>): Promise<DbOutcome<T>> => {
  try {
    await requireManager();
  } catch {
    return dbFailure("refused", "not-a-manager");
  }
  return fn();
};

/** "Reply timeout": how long a customer waits for the agent before the app answers directly. Owner or manager; merged into the settings of the installation. */
export const setReplyTimeout = async (installationId: string, seconds: number): Promise<DbOutcome<true>> =>
  guarded(async () => {
    const saved = await writeInstallationSettings({ installationId, name: "openclawTimeoutSec", value: seconds });
    if (saved.kind === "ok") revalidatePath("/", "layout");
    return saved;
  });

/** "Holding message": the fixed line a customer gets when the agent cannot answer in time (empty = the default). Owner or manager. */
export const setHoldingMessage = async (installationId: string, text: string): Promise<DbOutcome<true>> =>
  guarded(async () => {
    const saved = await writeInstallationSettings({ installationId, name: "holdingMessage", value: text });
    if (saved.kind === "ok") revalidatePath("/", "layout");
    return saved;
  });

/** What the sync card shows: the OpenClaw copy of the agent against what is active, and whether a sync is queued or running. */
export const getAgentSyncStatus = async (installationId: string): Promise<DbOutcome<AgentSyncStatus>> =>
  guarded(() => readAgentSync(installationId));

/** "Sync again": queue a sync now (also for a module that is not on OpenClaw yet). The card then polls the status. */
export const resyncAgent = async (installationId: string): Promise<DbOutcome<boolean>> =>
  guarded(async () => {
    const found = await readInstallation(installationId); // row level security: only installations of this workspace
    return found.kind === "ok" ? dbOk(await enqueueAgentSync(installationId, { force: true })) : found;
  });

/** Change how far an agent may go through a connection ("none" removes its access). Workspace owner only; the grant is the one the Connections page makes. */
export const grantAgentAccess = async (connectionId: string, agentId: string, level: string): Promise<DbOutcome<true>> => {
  const granted = await setGrant(connectionId, agentId, isAccess(level) ? level : null);
  return granted.ok ? dbOk(true) : dbFailure("refused", granted.error);
};
