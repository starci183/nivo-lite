/** Module foundation: pure types and the setup-gate catalogue (no I/O, safe in client components). Re-exported by modules-core.ts. */
import { MODULE_KEYS, MODULE_REGISTRY, isModuleKey, type ModuleKey } from "./module-registry";

export type { ModuleKey };
export { MODULE_KEYS, isModuleKey };

export type InstallationStatus = "installing" | "setup" | "ready" | "live" | "paused";
export type OperatingMode = "assist" | "autopilot";

/** One installed module of a workspace. */
export type Installation = {
  id: string;
  workspaceId: string;
  moduleKey: ModuleKey;
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
