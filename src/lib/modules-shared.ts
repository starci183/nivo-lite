/** Module foundation: pure types and the setup-gate catalogue (no I/O, safe in client components). Re-exported by modules-core.ts. */
import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey, type ModuleKey } from "./module-registry";

export type { ModuleKey };
export { MODULE_KEYS, isModuleKey };

export type InstallationStatus = "installing" | "setup" | "ready" | "live" | "paused";
export type OperatingMode = "assist" | "autopilot";

/**
 * One installed agent of a workspace: an INSTANCE of a module type. Single-instance types (accounting, inventory...) have one per workspace;
 * multi-instance types (chatbot, booking, lead_gen: isMultiInstance) may have several, each with its own name, agent, connections and setup.
 */
export type Installation = {
  id: string;
  workspaceId: string;
  moduleKey: ModuleKey;
  /** The instance label ("Chatbot – Chi nhánh Q1"); the type's name for the first instance and every single-instance type. */
  name: string;
  /** The type allows several instances (copied from the registry at insert). */
  isMulti: boolean;
  agentId: string | null;
  /** The agent's display name and handle (read-through, for headers and mentions). */
  agentName: string;
  agentHandle: string;
  status: InstallationStatus;
  operatingMode: OperatingMode;
  liveEnabled: boolean;
  activeContextVersionId: string | null;
  /** Number of the active context version, null before the first apply. */
  activeVersion: number | null;
  settings: Record<string, unknown>;
  createdAt: string;
};

export type SetupFact = { key: string; text: string };
export type GateStatus = "missing" | "proposed" | "confirmed";
export type GateEntry = { status: GateStatus; evidence: string; confirmed_by?: string | null; confirmed_at?: string | null };
export type GateEvidence = Record<string, GateEntry>;
export type DraftSnapshot = { summary: string; facts: SetupFact[] };

/** What a context version freezes: the draft plus the confirmed evidence per gate. */
export type ContextSnapshot = DraftSnapshot & { gates: GateEvidence };

/** An applied, immutable version of a module's business context. */
export type ContextVersion = {
  id: string;
  installationId: string;
  version: number;
  snapshot: ContextSnapshot;
  appliedBy: string;
  appliedAt: string;
};

/** The draft being built in the setup chat. */
export type SetupSession = {
  id: string;
  installationId: string;
  revision: number;
  status: "draft" | "applied" | "discarded";
  draft: DraftSnapshot;
  gateEvidence: GateEvidence;
  createdAt: string;
};

/** One revision of an installation's setup chat (the history dividers). */
export type SetupRevision = { id: string; revision: number; status: SetupSession["status"] };

export type SetupMessage = { id: string; setupSessionId: string; role: "user" | "assistant"; author: string; body: string; createdAt: string };

export type ModuleGate = { key: string; label_vi: string; label_en: string; hint_vi: string; hint_en: string };

/** What each module must know before it may act. Every gate is required to apply a setup. Comes from resources/modules/<key>/module.json. */
export const MODULE_GATES: Record<ModuleKey, Array<ModuleGate>> = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, MODULE_REGISTRY[k].gates.map((g) => ({ ...g }))]),
) as Record<ModuleKey, Array<ModuleGate>>;

/** Gate state, defaulting to missing. */
export const gateEntry = (evidence: GateEvidence, key: string): GateEntry => evidence[key] ?? { status: "missing", evidence: "" };

/** True when every gate of the module is confirmed. */
export const allGatesConfirmed = (moduleKey: ModuleKey, evidence: GateEvidence): boolean =>
  MODULE_GATES[moduleKey].every((g) => gateEntry(evidence, g.key).status === "confirmed");

export const gateLabel = (g: ModuleGate, locale: "vi" | "en"): string => (locale === "vi" ? g.label_vi : g.label_en);
export const gateHint = (g: ModuleGate, locale: "vi" | "en"): string => (locale === "vi" ? g.hint_vi : g.hint_en);

/** What a version would freeze from a draft: summary, facts and the confirmed gates only. */
export const snapshotOf = (draft: DraftSnapshot, gates: GateEvidence): ContextSnapshot => ({
  summary: draft.summary,
  facts: draft.facts,
  gates: Object.fromEntries(Object.entries(gates).filter(([, g]) => g.status === "confirmed")),
});

/* ------------------------------------------------------------------ instances (pure) */

/** Case-insensitive, trimmed key of an instance name (the database enforces unique (workspace, type, lower(name))). */
export const instanceNameKey = (name: string): string => name.trim().toLowerCase();

/**
 * The suggested name of a new instance of a type: the type's name for the first one, then "<Loại> 2", "<Loại> 3"... (the next number after
 * the instances that exist, skipping any name already taken, case-insensitive).
 */
export const nextInstanceName = (typeName: string, taken: ReadonlyArray<string>): string => {
  const used = new Set(taken.map(instanceNameKey));
  if (taken.length === 0 && !used.has(instanceNameKey(typeName))) return typeName;
  for (let n = Math.max(2, taken.length + 1); n < 1000; n += 1) {
    const candidate = `${typeName} ${n}`;
    if (!used.has(instanceNameKey(candidate))) return candidate;
  }
  return `${typeName} ${Date.now()}`;
};

/** A clean instance name, or null when it is too short or too long (1-80 characters after trimming, as in the database). */
export const cleanInstanceName = (name: string): string | null => {
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length >= 1 && clean.length <= 80 ? clean : null;
};

/** The instances of one type, oldest first (the first is what type-level callers mean by "the" installation). */
export const instancesOf = <T extends Pick<Installation, "moduleKey" | "createdAt">>(installations: ReadonlyArray<T>, moduleKey: ModuleKey): Array<T> =>
  installations.filter((i) => i.moduleKey === moduleKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** Shown name of an instance: its own name when the type has several (or it was renamed), else nothing extra is needed. */
export const showsInstanceName = (i: Pick<Installation, "isMulti" | "name">, typeName: string): boolean => i.isMulti || instanceNameKey(i.name) !== instanceNameKey(typeName);

/**
 * The route of an agent instance: /agents/<type>/<installationId>[/workbench|/settings][?query]. Without an installation id it is the
 * type-level URL (/agents/<type>[/tab]), which redirects to the only instance, or to the instance that owns `?focus=`, or to the list.
 */
export const agentHref = (module: ModuleKey, installationId: string | null | undefined, tab: "setup" | "workbench" | "settings" = "setup", query?: string): string => {
  const base = installationId ? `/agents/${module}/${installationId}` : `/agents/${module}`;
  const path = tab === "setup" ? base : `${base}/${tab}`;
  return query ? `${path}?${query}` : path;
};

/** The list of a type's instances (/agents/<type>?list=1): shown even when there is only one, so "Thêm <loại> mới" is always reachable. */
export const agentListHref = (module: ModuleKey): string => `/agents/${module}?list=1`;
