/**
 * The setup chat as the way to fill the Second Brain and set an agent's boundaries (pure, no I/O, safe in client components).
 * A gate of a module.json may declare `writes`: what NIVO extracts from the owner's answer, either a Second Brain fact
 * (subject type, attribute, scope) or one field of an authority rule (action + mode | limit_vnd). The model proposes values,
 * this file keeps only what the gate declared, and the owner confirms each one on a card before anything is written.
 */
import { actionDef, moduleDef, type ModuleKey } from "./module-registry";
import type { GateWrite } from "./module-registry.generated";
import { keyOf } from "./brain/shared";
import type { Scope, SubjectType } from "./brain/shared";
import type { FlowAction, RuleMode } from "./flow-types";

export type { GateWrite };

export const WRITE_STATUSES = ["proposed", "applied", "rejected", "superseded"] as const;
export type WriteStatus = (typeof WRITE_STATUSES)[number];

/** A fact the owner is asked to confirm: subject · attribute · value · scope. `gapId` links it to the customer question it answers. */
export type FactPayload = {
  subjectType: SubjectType; subjectLabel: string; attributeLabel: string; value: string; scope: Scope; gapId?: string;
};
/** A rule change the owner is asked to confirm: action · mode · limit (the complete resulting rule; the unchanged half is copied from the rule in force). */
export type RulePayload = { action: FlowAction; field: "mode" | "limit_vnd"; mode: RuleMode; limitVnd: number | null };

/** How an owner settled a fact that disagrees with the one in force: replace it (history is kept), keep it, or keep both for different situations. */
export type Resolution = "replace" | "keep" | "both";
export type WriteResult = { outcome: string; factId?: string; resolution?: Resolution; ruleId?: string };

type Base = { id: string; setupSessionId: string; sourceMessageId: string | null; gateKey: string; status: WriteStatus; result: WriteResult | null; decidedBy: string | null; createdAt: string };
export type FactCurrent = { value: string; scope: Scope; modules: ReadonlyArray<string> };
export type RuleCurrent = { mode: RuleMode; limitVnd: number | null };
export type FactWrite = Base & { kind: "fact"; payload: FactPayload; /** The value in force for the same subject + attribute, when there is one. */ current: FactCurrent | null };
export type RuleWrite = Base & { kind: "rule"; payload: RulePayload; /** The rule in force. */ current: RuleCurrent | null };
export type SetupWrite = FactWrite | RuleWrite;

/** The owner's decision on one card, with their edits. */
export type WriteDecision =
  | { decision: "reject" }
  | {
    decision: "confirm"; fact?: { value: string; scope: Scope; subjectLabel?: string; attributeLabel?: string }; rule?: { mode: RuleMode; limitVnd: number | null }; resolution?: Resolution; situation?: string;
    /** Multi-instance agent (one Chatbot per branch): the fact is for THIS instance only instead of every instance of the type (the default). */
    onlyThisAgent?: boolean;
  };

/** What the model returned for one write, before validation. */
export type ProposedFact = { gateKey: string; kind: "fact"; payload: FactPayload };
export type ProposedRule = { gateKey: string; kind: "rule"; payload: Omit<RulePayload, "mode" | "limitVnd"> & { mode: RuleMode | null; limitVnd: number | null | undefined } };
export type ProposedWrite = ProposedFact | ProposedRule;

/** The gate key of a write that answers a customer question (a knowledge gap) rather than a checklist item. */
export const GAP_GATE = "gap";

/** The key that makes two cards the same target: one waiting card per target. */
export const targetKey = (w: ProposedWrite): string =>
  w.kind === "fact" ? `fact:${keyOf(w.payload.subjectLabel)}|${keyOf(w.payload.attributeLabel)}` : `rule:${w.payload.action}`;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"];

/** The writes a gate declares (empty for a gate that declares none). */
export const gateWrites = (moduleKey: ModuleKey, gateKey: string): ReadonlyArray<GateWrite> =>
  moduleDef(moduleKey).gates.find((g) => g.key === gateKey)?.writes ?? [];

/** An amount typed by the model: a number, or "20 triệu" / "1,5 tỷ" / "20000000". */
const vnd = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const m = v.toLowerCase().replace(/\s+/g, " ").match(/^([\d.,]+)\s*(tỷ|ty|triệu|trieu|tr|m|k|nghìn|ngàn)?/u);
  if (!m) return null;
  const digits = m[2] ? m[1].replace(",", ".") : m[1].replace(/[.,]/g, "");
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? "";
  const mult = /tỷ|ty/.test(unit) ? 1e9 : /triệu|trieu|tr|m/.test(unit) ? 1e6 : /k|nghìn|ngàn/.test(unit) ? 1e3 : 1;
  return Math.round(n * mult);
};

/** An open customer question the owner can answer in the setup chat. */
export type OpenGap = { id: string; question: string; topic: string | null; attributeGuess: string | null; count: number };

/**
 * Keep only the writes the module declared. A fact must match a declared fact write of its gate (attribute), and takes the declared
 * subject type and scope: the owner chooses the audience per gate in module.json, the model never widens it. A rule must match a declared
 * rule write (action + field). A write for a customer question (`gap`) is a fact about the module's own audience. Max 8 per turn.
 */
export const sanitizeWrites = (moduleKey: ModuleKey, raw: unknown, gaps: ReadonlyArray<OpenGap> = []): Array<ProposedWrite> => {
  if (!Array.isArray(raw)) return [];
  const def = moduleDef(moduleKey);
  const out = new Map<string, ProposedWrite>();
  for (const item of raw) {
    if (!isObject(item)) continue;
    const gateKey = clean(item.gate, 60);
    const kind = item.kind === "rule" ? "rule" : item.kind === "fact" ? "fact" : null;
    if (!kind) continue;

    if (kind === "fact") {
      const subjectLabel = clean(item.subject, 160);
      const value = clean(item.value, 2000);
      if (!value) continue;
      if (gateKey === GAP_GATE) {
        const gap = gaps.find((g) => g.id === clean(item.gap, 60));
        const attributeLabel = clean(item.attribute, 120) || gap?.attributeGuess || "";
        const subject = subjectLabel || gap?.topic || "";
        if (!gap || !attributeLabel || !subject) continue;
        const scope: Scope = def.audience === "customer" ? "public" : "internal";
        const w: ProposedFact = { gateKey: GAP_GATE, kind: "fact", payload: { subjectType: "other", subjectLabel: subject.slice(0, 160), attributeLabel: attributeLabel.slice(0, 120), value, scope, gapId: gap.id } };
        out.set(targetKey(w), w);
        continue;
      }
      const declared = gateWrites(moduleKey, gateKey).filter((w): w is Extract<GateWrite, { kind: "fact" }> => w.kind === "fact");
      const asked = clean(item.attribute, 120);
      const spec = declared.find((w) => keyOf(w.attributeLabel) === keyOf(asked)) ?? (declared.length === 1 && !asked ? declared[0] : undefined);
      if (!spec) continue;
      const subject = subjectLabel || (spec.subjectType === "business" ? "Doanh nghiệp" : "");
      if (!subject) continue;
      const w: ProposedFact = { gateKey, kind: "fact", payload: { subjectType: spec.subjectType, subjectLabel: subject, attributeLabel: spec.attributeLabel, value, scope: spec.scope } };
      out.set(targetKey(w), w);
      continue;
    }

    const action = clean(item.action, 60);
    const spec = gateWrites(moduleKey, gateKey).find((w): w is Extract<GateWrite, { kind: "rule" }> => w.kind === "rule" && w.action === action);
    if (!spec) continue;
    const def2 = actionDef(spec.action);
    if (spec.field === "mode") {
      const mode = MODES.find((m) => m === item.mode);
      if (!mode || (mode === "auto" && def2.maxMode !== null)) continue;
      const w: ProposedRule = { gateKey, kind: "rule", payload: { action: spec.action, field: "mode", mode, limitVnd: undefined } };
      out.set(targetKey(w), w);
    } else {
      const limitVnd = vnd(item.limit_vnd);
      if (limitVnd === null || limitVnd <= 0 || !def2.amountLimit) continue;
      const w: ProposedRule = { gateKey, kind: "rule", payload: { action: spec.action, field: "limit_vnd", mode: null, limitVnd } };
      out.set(targetKey(w), w);
    }
  }
  return [...out.values()].slice(0, 8);
};

/** What the model is told each gate may write, one line per declared write. */
export const writeSpecLines = (moduleKey: ModuleKey): Array<string> =>
  moduleDef(moduleKey).gates.flatMap((g) => (g.writes ?? []).map((w) => {
    if (w.kind === "fact") return `- gate ${g.key}: fact | subjectType ${w.subjectType} | attribute "${w.attributeLabel}" | audience ${w.scope}`;
    const a = actionDef(w.action);
    return `- gate ${g.key}: rule | action ${w.action} (${a.label.en}) | ${w.field === "mode" ? 'field mode: "auto" (runs by itself), "ask" (asks the owner first) or "never"' : "field limit_vnd: the amount in VND below which it runs by itself"}${w.field === "mode" && a.maxMode !== null ? ' (never "auto")' : ""}`;
  }));
