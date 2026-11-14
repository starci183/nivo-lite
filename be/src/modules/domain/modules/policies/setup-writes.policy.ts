import { SUBJECT_TYPES, factSlugOf, type BrainSubjectType, type Scope } from "@modules/domain/brain-facts"
import type { FactCardPayload, ProposedCardRecord } from "@modules/domain/module-setup-writes"
import type { ModuleDefinition, ModuleGate, FactWrite } from "../modules.contracts"

/** The gate key of a write that answers a customer question (a knowledge gap) rather than a checklist item. */
export const GAP_GATE = "gap"

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

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const FACT_SUBJECTS: ReadonlyArray<BrainSubjectType> = SUBJECT_TYPES

/** The key that makes two cards the same target: one waiting card per target. */
export const targetKeyOf = (write: ProposedFact): string =>
    `fact:${factSlugOf(write.payload.subjectLabel)}|${factSlugOf(write.payload.attributeLabel)}`

/** The writes a gate declares; none for a gate that declares none. */
export const gateWritesOf = (module: ModuleDefinition, gateKey: string): ReadonlyArray<FactWrite> =>
    module.gates.find((gate) => gate.key === gateKey)?.writes ?? []

const factOfGap = (
    module: ModuleDefinition,
    item: Record<string, unknown>,
    value: string,
    subjectLabel: string,
    gaps: ReadonlyArray<OpenGap>,
): ProposedFact | null => {
    const gap = gaps.find((candidate) => candidate.id === clean(item.gap, 60))
    const attributeLabel = clean(item.attribute, 120) || (gap?.attributeGuess ?? "")
    const subject = subjectLabel || (gap?.topic ?? "")
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
    const declared = gateWritesOf(module, gateKey)
    const asked = clean(item.attribute, 120)
    const spec =
        declared.find((write) => factSlugOf(write.attributeLabel) === factSlugOf(asked)) ??
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

/**
 * Keeps only the writes the module declared. A fact must match a declared fact write of its gate (attribute) and takes the declared
 * subject type and scope: the owner chooses the audience per gate, the model never widens it. A write for a customer question (`gap`)
 * is a fact about the audience of the module. At most eight per turn.
 */
export const sanitizeWrites = (
    module: ModuleDefinition,
    raw: unknown,
    gaps: ReadonlyArray<OpenGap>,
    businessLabel: string,
): ReadonlyArray<ProposedFact> => {
    if (!Array.isArray(raw)) return []
    const kept = new Map<string, ProposedFact>()
    for (const item of raw) {
        if (!isObject(item)) continue
        const gateKey = clean(item.gate, 60)
        const value = clean(item.value, 2000)
        const subjectLabel = clean(item.subject, 160)
        if (item.kind !== "fact" || value === "") continue
        const write =
            gateKey === GAP_GATE
                ? factOfGap(module, item, value, subjectLabel, gaps)
                : factOfGate(module, item, gateKey, value, subjectLabel, businessLabel)
        if (write !== null) kept.set(targetKeyOf(write), write)
    }
    return [...kept.values()].slice(0, WRITES_PER_TURN)
}

/** What the model is told each gate may write, one line per declared fact. */
export const writeSpecLines = (module: ModuleDefinition): ReadonlyArray<string> =>
    module.gates.flatMap((gate: ModuleGate) =>
        gateWritesOf(module, gate.key).map(
            (write) =>
                `- gate ${gate.key}: fact | subjectType ${write.subjectType} | attribute "${write.attributeLabel}" | audience ${write.scope}`,
        ),
    )

/** The stored shape of a proposed write: the card the owner will see. */
export const cardOf = (write: ProposedFact, payload: ProposedCardRecord["payload"]): ProposedCardRecord => ({
    gate_key: write.gateKey,
    kind: write.kind,
    target_key: targetKeyOf(write),
    payload,
})
