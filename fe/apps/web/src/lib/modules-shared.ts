/**
 * Shim (Wave 3 deletes it): the module foundation moved to modules/installations (types, setup gates, instance names and routes) and
 * modules/catalog (the catalogue). The path and every export stay for the lanes that still import them from here.
 */
import { MODULE_KEYS, MODULE_REGISTRY, type RegistryGate } from "@/modules/catalog";
import { isModuleKey, type ModuleKey } from "./module-registry";

export type { ModuleKey };
export { MODULE_KEYS, isModuleKey };
export type {
  ContextSnapshot, ContextVersion, DraftSnapshot, GateEntry, GateEvidence, GateStatus, Installation, InstallationStatus, OperatingMode,
  SetupFact, SetupMessage, SetupRevision, SetupSession,
} from "@/modules/installations";
export {
  agentDisplayName, agentHref, agentListHref, allGatesConfirmed, cleanInstanceName, gateEntry, gateHint, gateLabel, instanceNameKey, instancesOf,
  nextInstanceName, showsInstanceName, snapshotOf,
} from "@/modules/installations";

export type ModuleGate = RegistryGate;

/** What each module must know before it may act (read through gatesOf in new code). */
export const MODULE_GATES: Record<ModuleKey, Array<ModuleGate>> = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, MODULE_REGISTRY[k].gates.map((g) => ({ ...g }))]),
) as Record<ModuleKey, Array<ModuleGate>>;
