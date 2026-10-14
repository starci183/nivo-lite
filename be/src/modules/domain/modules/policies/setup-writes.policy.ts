import type { RuleMode } from "@modules/domain/authority-rules"
import { SUBJECT_TYPES, keyOf } from "@modules/domain/brain-facts"
import type { BrainSubjectType, Scope } from "@modules/domain/brain-facts"
import type { FactCardPayload, ProposedCardRecord } from "@modules/domain/module-setup-writes"
import type { AuthorityActionDefinition, ModuleDefinition, ModuleGate, GateWrite } from "../modules.contracts"

/** The gate key of a write that answers a customer question (a knowledge gap) rather than a checklist item. */
export const GAP_GATE = "gap"

const MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"]
const UNIT_MULTIPLIER: Readonly<Record<string, number>> = {
    ty: 1e9,
    trieu: 1e6,
    tr: 1e6,
    m: 1e6,
    k: 1e3,
    nghin: 1e3,
    ngan: 1e3,
}
const WRITES_PER_TURN = 8

/** An open customer question the owner can answer in the setup chat. */
export interface OpenGap {
    /** The gap. */
    readonly id: string
    /** The question. */
    readonly question: string
    /** The subject guess. */
    readonly topic: string | null
    /** The attribute guess. */
    readonly attributeGuess: string | null
    /** How often it was asked. */
    readonly count: number
}

/** A fact the model proposed, validated against what the gate declares. */
export interface ProposedFact {
    /** The gate it answers. */
    readonly gateKey: string
    /** Discriminator. */
    readonly kind: "fact"
    /** The fact. */
    readonly payload: FactCardPayload
}

/** The change of a rule the model proposed: the half it did not touch stays unset until the rule in force is read. */
export interface ProposedRulePayload {
    /** The authority action. */
    readonly action: string
    /** Which field the answer set. */
    readonly field: "mode" | "limit_vnd"
    /** The proposed mode; null when the answer is about the limit. */
    readonly mode: RuleMode | null
    /** The proposed limit, VND; undefined when the answer is about the mode. */
    readonly limitVnd: number | null | undefined
}

/** A rule change the model proposed. */
export interface ProposedRule {
    /** The gate it answers. */
    readonly gateKey: string
    /** Discriminator. */
    readonly kind: "rule"
    /** The change. */
    readonly payload: ProposedRulePayload
}

/** One write the model proposed. */
export type ProposedWrite = ProposedFact | ProposedRule

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const FACT_SUBJECTS: ReadonlyArray<BrainSubjectType> = SUBJECT_TYPES

/** The key that makes two cards the same target: one waiting card per target. */
export const targetKeyOf = (write: ProposedWrite): string =>
    write.kind === "fact"
        ? `fact:${keyOf(write.payload.subjectLabel)}|${keyOf(write.payload.attributeLabel)}`
        : `rule:${write.payload.action}`

/** An amount typed by the model: a number, or "20 trieu" / "1,5 ty" / "20000000" (accents are ignored). */
export const vndOf = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
    if (typeof value !== "string") return null
    const found = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ")
        .match(/^([\d.,]+)\s*(ty|trieu|tr|m|k|nghin|ngan)?/u)
    if (found === null) return null
    const unit = found[2] ?? ""
    const digits = unit === "" ? (found[1] ?? "").replace(/[.,]/g, "") : (found[1] ?? "").replace(",", ".")
    const amount = Number(digits)
    if (!Number.isFinite(amount)) return null
    return Math.round(amount * (UNIT_MULTIPLIER[unit] ?? 1))
}

/** The writes a gate declares; none for a gate that declares none. */
export const gateWritesOf = (module: ModuleDefinition, gateKey: string): ReadonlyArray<GateWrite> =>
    module.gates.find((gate) => gate.key === gateKey)?.writes ?? []

const actionOf = (module: ModuleDefinition, action: string): AuthorityActionDefinition | undefined =>
    module.authorityActions.find((candidate) => candidate.action === action)

const factOfGap = (
    module: ModuleDefinition,
    item: Record<string, unknown>,
    value: string,
    subjectLabel: string,
    gaps: ReadonlyArray<OpenGap>,
): ProposedFact | null => {
    const gap = gaps.find((candidate) => candidate.id === clean(item.gap, 60))
    const attributeLabel = clean(item.attribute, 120) || gap?.attributeGuess || ""
    const subject = subjectLabel || gap?.topic || ""
    if (gap === undefined || attributeLabel === "" || subject === "") return null
    const scope: Scope = module.audience === "customer" ? "public" : "internal"
    return {
        gateKey: GAP_GATE,
        kind: "fact",
        payload: {
            subjectType: "other",
            subjectLabel: subject.slice(0, 160),
            attributeLabel: attributeLabel.slice(0, 120),
            value,
            scope,
            gapId: gap.id,
        },
    }
}

const factOfGate = (
    module: ModuleDefinition,
    item: Record<string, unknown>,
    gateKey: string,
    value: string,
    subjectLabel: string,
    businessLabel: string,
): ProposedFact | null => {
    const declared = gateWritesOf(module, gateKey).filter((write) => write.kind === "fact")
    const asked = clean(item.attribute, 120)
    const spec =
        declared.find((write) => keyOf(write.attributeLabel) === keyOf(asked)) ??
        (declared.length === 1 && asked === "" ? declared[0] : undefined)
    if (spec === undefined) return null
    const subject = subjectLabel || (spec.subjectType === "business" ? businessLabel : "")
    if (subject === "") return null
    return {
        gateKey,
        kind: "fact",
        payload: {
            subjectType: FACT_SUBJECTS.includes(spec.subjectType) ? spec.subjectType : "other",
            subjectLabel: subject,
            attributeLabel: spec.attributeLabel,
            value,
            scope: spec.scope,
        },
    }
}

const ruleOfGate = (module: ModuleDefinition, item: Record<string, unknown>, gateKey: string): ProposedRule | null => {
    const action = clean(item.action, 60)
    const spec = gateWritesOf(module, gateKey)
        .filter((write) => write.kind === "rule")
        .find((write) => write.action === action)
    if (spec === undefined) return null
    const definition = actionOf(module, spec.action)
    if (definition === undefined) return null
    if (spec.field === "mode") {
        const mode = MODES.find((candidate) => candidate === item.mode)
        if (mode === undefined || (mode === "auto" && definition.maxMode !== null)) return null
        return { gateKey, kind: "rule", payload: { action: spec.action, field: "mode", mode, limitVnd: undefined } }
    }
    const limitVnd = vndOf(item.limit_vnd)
    if (limitVnd === null || limitVnd <= 0 || !definition.amountLimit) return null
    return { gateKey, kind: "rule", payload: { action: spec.action, field: "limit_vnd", mode: null, limitVnd } }
}

/**
 * Keeps only the writes the module declared. A fact must match a declared fact write of its gate (attribute) and takes the declared
 * subject type and scope: the owner chooses the audience per gate, the model never widens it. A rule must match a declared rule write
 * (action and field). A write for a customer question (`gap`) is a fact about the audience of the module. At most eight per turn.
 */
export const sanitizeWrites = (
    module: ModuleDefinition,
    raw: unknown,
    gaps: ReadonlyArray<OpenGap>,
    businessLabel: string,
): ReadonlyArray<ProposedWrite> => {
    if (!Array.isArray(raw)) return []
    const kept = new Map<string, ProposedWrite>()
    for (const item of raw) {
        if (!isObject(item)) continue
        const gateKey = clean(item.gate, 60)
        const value = clean(item.value, 2000)
        const subjectLabel = clean(item.subject, 160)
        let write: ProposedWrite | null = null
        if (item.kind === "rule") write = ruleOfGate(module, item, gateKey)
        else if (item.kind === "fact" && value !== "") {
            write =
                gateKey === GAP_GATE
                    ? factOfGap(module, item, value, subjectLabel, gaps)
                    : factOfGate(module, item, gateKey, value, subjectLabel, businessLabel)
        }
        if (write !== null) kept.set(targetKeyOf(write), write)
    }
    return [...kept.values()].slice(0, WRITES_PER_TURN)
}

/** What the model is told each gate may write, one line per declared write. */
export const writeSpecLines = (module: ModuleDefinition): ReadonlyArray<string> =>
    module.gates.flatMap((gate: ModuleGate) =>
        (gate.writes ?? []).map((write) => {
            if (write.kind === "fact") {
                return `- gate ${gate.key}: fact | subjectType ${write.subjectType} | attribute "${write.attributeLabel}" | audience ${write.scope}`
            }
            const definition = actionOf(module, write.action)
            const label = definition?.label.en ?? write.action
            const field =
                write.field === "mode"
                    ? 'field mode: "auto" (runs by itself), "ask" (asks the owner first) or "never"'
                    : "field limit_vnd: the amount in VND below which it runs by itself"
            const capped = write.field === "mode" && definition?.maxMode !== null ? ' (never "auto")' : ""
            return `- gate ${gate.key}: rule | action ${write.action} (${label}) | ${field}${capped}`
        }),
    )

/** The stored shape of a proposed write once the rule in force completed it: the card the owner will see. */
export const cardOf = (write: ProposedWrite, payload: ProposedCardRecord["payload"]): ProposedCardRecord => ({
    gate_key: write.gateKey,
    kind: write.kind,
    target_key: targetKeyOf(write),
    payload,
})
