import "server-only";
import { cache } from "react";
import { getSession } from "./session";
import { isModuleKey, type ModuleKey } from "./module-registry";
import { readActiveContext, readContextVersions, readInstallations } from "@/modules/db";
export { toSession, toVersion } from "@/modules/db";
import { instancesOf, type ContextVersion, type Installation } from "@/modules/installations";

/**
 * Shim (Wave 3 deletes it): the installations of the signed-in workspace, read through modules/db/modules under the row level security of
 * the member. The path and the readers stay for the lanes that still import them from here.
 */
export * from "./modules-shared";

/** Every installed agent (instance) of the signed-in workspace, oldest first. */
export const listInstallations = cache(async (): Promise<Array<Installation>> => {
  const session = await getSession();
  const outcome = await readInstallations(session.workspace.id);
  if (outcome.kind !== "ok") throw new Error(`installations: ${outcome.kind}`);
  return [...outcome.value];
});

/**
 * The FIRST (oldest) installation of a type in the signed-in workspace, null when it is not installed. For a single-instance type that is
 * the installation; for a multi-instance type prefer getInstallationById (an instance route) or listInstances.
 */
export const getInstallation = async (moduleKey: ModuleKey): Promise<Installation | null> => {
  if (!isModuleKey(moduleKey)) return null;
  return instancesOf(await listInstallations(), moduleKey)[0] ?? null;
};

/** Every instance of a type in the signed-in workspace, oldest first. */
export const listInstances = async (moduleKey: ModuleKey): Promise<Array<Installation>> =>
  isModuleKey(moduleKey) ? instancesOf(await listInstallations(), moduleKey) : [];

/** One installation of the signed-in workspace by id (RLS and the cached list keep it inside the workspace), null when unknown. */
export const getInstallationById = async (installationId: string): Promise<Installation | null> =>
  (await listInstallations()).find((i) => i.id === installationId) ?? null;

/** The context version in use for an instance (what its agent runs on), null when none has been applied. */
export const getActiveContextOf = async (installationId: string): Promise<ContextVersion | null> => {
  const installation = await getInstallationById(installationId);
  if (!installation?.activeContextVersionId) return null;
  const outcome = await readActiveContext(installation.activeContextVersionId);
  return outcome.kind === "ok" ? outcome.value : null;
};

/** All applied versions of a module, newest first. */
export const listContextVersions = async (installationId: string): Promise<Array<ContextVersion>> => {
  const outcome = await readContextVersions(installationId);
  if (outcome.kind !== "ok") throw new Error(`context versions: ${outcome.kind}`);
  return [...outcome.value];
};

