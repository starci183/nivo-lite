import { createHash } from "node:crypto"
import { factSlugOf, foldedText, inForce, type BrainSubjectType, type FactRecord } from "@modules/domain/brain-facts"
import { policyValueOf, type PolicyValueType } from "./policy-value.policy"

/**
 * The AI-derived layer over the truth graph (owner, 2026-11-11): which truths are rules of how the shop operates, under which title and
 * group. Everything here is pure: what a pass must do (`derivePlanOf`), the prompt of one batch and the reading of its answer. Nothing
 * names a key, a slot or a business line: the only inputs are the facts themselves and the judgements already made.
 */

/**
 * The most facts one model call judges (D-BR-2). Measured on dev (R1-R2, Claude Haiku 5.5, the `work` profile): one judgement is about
 * 100 characters of Vietnamese title + group + reason, 80-100 visible tokens with its JSON, and the model still spends hidden reasoning
 * (966 of 2,711 tokens on a 19-fact batch although the call says `effort: "off"`: the Anthropic protocol gets no reasoning field from the
 * app, see `DERIVE_BUDGET`). So about 150 tokens a fact: 12 facts are ~1,800 tokens under a 4,000 cap (2.2x headroom). A cut answer is
 * halved and judged again, never retried whole.
 */
export const DERIVE_BATCH = 12

/** The most model calls one pass plans (120 facts, as before); a workspace with more to judge continues in a follow-up job. */
export const DERIVE_MAX_CALLS = 10

/** The longest title, group and reason kept (the table's checks are wider). */
export const TITLE_MAX = 80
export const GROUP_MAX = 40
export const REASON_MAX = 200

/** The longest label and value of a fact put in the prompt. */
const LABEL_CHARS = 80
const VALUE_CHARS = 160

/** The most groups in use the prompt lists. */
const GROUPS_MAX = 30

/**
 * Subject types that are never a rule of the shop and are never sent to the model: a customer and a person are never served to an
 * agent either (`brain-facts/fact-view.policy.ts` `isServed`), and their facts are personal data.
 */
const NEVER_JUDGED: ReadonlySet<BrainSubjectType> = new Set<BrainSubjectType>(["customer", "person"])

/** One judgement of the derived layer, as stored. */
export interface DerivedPolicy {
    /** The row id. */
    readonly id: string
    /** The truth it judges. */
    readonly subjectKey: string
    /** The attribute key. */
    readonly attribute: string
    /** The one agent instance, or null. */
    readonly installationId: string | null
    /** The fact it is bound to. */
    readonly factId: string
    /** That fact's version; null for a value not in force yet. */
    readonly factVersion: number | null
    /** The hash of what the judgement read. */
    readonly basis: string
    /** A rule of the shop, or not. */
    readonly kind: "policy" | "not_policy"
    /** The human title; empty for `not_policy`. */
    readonly title: string
    /** The group's slug. */
    readonly groupKey: string
    /** The group as people read it. */
    readonly groupLabel: string
    /** The value type when derived or last bound. */
    readonly valueType: string
    /** The AI's short reason. */
    readonly reason: string
    /** `open` or `retired`. */
    readonly status: "open" | "retired"
}

/** What the model said about one fact. */
export interface PolicyJudgement {
    /** Whether the fact is a rule of how the shop operates. */
    readonly policy: boolean
    /** The human title (empty when not a policy). */
    readonly title: string
    /** The group (empty when not a policy). */
    readonly group: string
    /** One short sentence why. */
    readonly reason: string
}

/** A fact the model must judge: new to the layer (`known` null) or changed in what the judgement read (`known` = the judgement so far). */
export interface DeriveAsk {
    /** The fact that holds the truth now. */
    readonly fact: FactRecord
    /** The judgement so far, or null. */
    readonly known: DerivedPolicy | null
}

/** A judgement that follows its truth to another fact, with no model call. */
export interface DeriveRebind {
    /** The judgement. */
    readonly id: string
    /** The fact that holds the truth now. */
    readonly factId: string
    /** Its version. */
    readonly factVersion: number | null
    /** Its value type. */
    readonly valueType: PolicyValueType
}

/** What one pass must do. */
export interface DerivePlan {
    /** Facts the model judges (add, or amend). */
    readonly ask: ReadonlyArray<DeriveAsk>
    /** Judgements that follow their truth to its new value (or come back when the truth is held again). */
    readonly rebind: ReadonlyArray<DeriveRebind>
    /** Judgements whose truth is no longer in force or scheduled. */
    readonly retire: ReadonlyArray<string>
}

/** The key of a truth: subject, attribute and instance scope. */
export const truthKeyOf = (one: Pick<FactRecord, "subjectKey" | "attribute" | "installationId">): string =>
    `${one.subjectKey}\u0000${one.attribute}\u0000${one.installationId ?? ""}`

/** The value type of a fact, read from its value alone. */
export const valueTypeOf = (fact: Pick<FactRecord, "value" | "unit">): PolicyValueType => policyValueOf(fact.value, fact.unit).type

/**
 * The hash of what a judgement reads of a fact: its subject type, its labels and its value TYPE, never the value. So a new value of
 * the same kind (30,000 to 35,000 VND) keeps the judgement, and a relabelled truth or a value of another kind is compared again.
 */
export const basisOf = (fact: Pick<FactRecord, "subjectType" | "subjectLabel" | "attributeLabel" | "value" | "unit">): string =>
    createHash("sha256")
        .update([fact.subjectType, foldedText(fact.subjectLabel), foldedText(fact.attributeLabel), valueTypeOf(fact)].join("|"))
        .digest("hex")
        .slice(0, 32)

/** Whether a fact may be judged at all. */
export const isJudged = (fact: Pick<FactRecord, "subjectType">): boolean => !NEVER_JUDGED.has(fact.subjectType)

/**
 * The fact that holds each truth now, from the active and scheduled facts of a workspace: the value in force (the newest version),
 * else the value approved for the nearest later start. Customer and person facts are left out.
 */
export const heldByTruth = (facts: ReadonlyArray<FactRecord>, at: number): ReadonlyMap<string, FactRecord> => {
    const held = new Map<string, FactRecord>()
    const rank = (fact: FactRecord): readonly [number, number] =>
        inForce(fact, at) ? [1, fact.version ?? 0] : [0, -Date.parse(fact.validFrom ?? fact.proposedAt)]
    facts
        .filter((fact) => (fact.status === "active" || fact.status === "scheduled") && fact.proposalKind === "set" && isJudged(fact))
        .forEach((fact) => {
            const key = truthKeyOf(fact)
            const other = held.get(key)
            if (other === undefined) {
                held.set(key, fact)
                return
            }
            const [mine, theirs] = [rank(fact), rank(other)]
            if (mine[0] > theirs[0] || (mine[0] === theirs[0] && mine[1] > theirs[1])) held.set(key, fact)
        })
    return held
}

/**
 * What a pass must do, from the facts that hold each truth and the judgements stored: a truth with no judgement, or whose basis
 * changed, is asked; a judged truth held by another fact (the next version after an edit), or held again after it was retired,
 * re-binds with no model call; a judgement whose truth nothing holds is retired. Running it on its own result plans nothing.
 */
export const derivePlanOf = (held: ReadonlyMap<string, FactRecord>, stored: ReadonlyArray<DerivedPolicy>): DerivePlan => {
    const byTruth = new Map(stored.map((row) => [truthKeyOf(row), row]))
    const ask: Array<DeriveAsk> = []
    const rebind: Array<DeriveRebind> = []
    held.forEach((fact, key) => {
        const known = byTruth.get(key) ?? null
        if (known?.basis !== basisOf(fact)) {
            ask.push({ fact, known })
            return
        }
        const version = fact.version ?? null
        const valueType = valueTypeOf(fact)
        if (known.status === "retired" || known.factId !== fact.id || known.factVersion !== version || known.valueType !== valueType) {
            rebind.push({ id: known.id, factId: fact.id, factVersion: version, valueType })
        }
    })
    const retire = stored.filter((row) => row.status === "open" && !held.has(truthKeyOf(row))).map((row) => row.id)
    return { ask, rebind, retire }
}

/** The slug of a group label. */
export const groupKeyOf = (label: string): string => factSlugOf(label)

/** The instruction of the derive call: fixed text, so the provider may cache it. */
export const DERIVE_SYSTEM: string = [
    "You read facts from the truth graph of one small shop and decide, for each fact, whether it is a POLICY.",
    "A policy is a rule of how the shop operates that the owner may tune as a parameter: a fee, a threshold, a deadline, opening hours,",
    "a discount, the terms of delivery, return, refund, deposit, payment or booking, what the staff or an agent may or must do.",
    "NOT a policy: identity or contact data (name, address, phone, e-mail, website, bank account, tax code, social links), a description",
    "or the history of the shop, the catalogue (a product, its price, size, colour, stock), a supplier, a place, a one-off event.",
    "Judge only from the fact given. Never invent a fact or a value, never put a value in a title.",
    "For a policy give: `title`, a short Vietnamese name of the rule without its value (at most 60 characters); `group`, a short",
    "Vietnamese name shared by related rules (at most 30 characters; reuse a group in use when one fits); `reason`, one short",
    "Vietnamese sentence saying why it is a rule (at most 120 characters).",
    "A fact marked `was` changed and is compared again: keep its title and group unless they no longer fit.",
    'Answer ONLY a JSON list with one item per fact: {"i": <index>, "policy": true | false, "title": "", "group": "", "reason": ""}.',
    "For `policy` false leave `title` and `group` empty and still give the reason.",
].join("\n")

/** A text cut to a length, on one line. */
const cut = (text: string, chars: number): string => text.replaceAll(/\s+/g, " ").trim().slice(0, chars)

/** The groups in use among the open policies, most used first. */
export const groupsInUse = (stored: ReadonlyArray<DerivedPolicy>): ReadonlyArray<string> => {
    const counts = new Map<string, number>()
    stored
        .filter((row) => row.kind === "policy" && row.status === "open" && row.groupLabel !== "")
        .forEach((row) => counts.set(row.groupLabel, (counts.get(row.groupLabel) ?? 0) + 1))
    return [...counts.entries()]
        .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
        .slice(0, GROUPS_MAX)
        .map(([label]) => label)
}

/** What the judgement so far says, for a fact compared again. */
const wasOf = (known: DerivedPolicy | null): string => {
    if (known === null) return ""
    return known.kind === "policy" ? ` (was: policy "${known.title}" in group "${known.groupLabel}")` : " (was: not a policy)"
}

/** The user part of one derive call: the groups in use, then the batch, one numbered line per fact. */
export const derivePrompt = (batch: ReadonlyArray<DeriveAsk>, groups: ReadonlyArray<string>): string => {
    const lines = batch.map(({ fact, known }, index) => {
        const value = cut(fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`, VALUE_CHARS)
        return `${String(index)}. [${fact.subjectType}] ${cut(fact.subjectLabel, LABEL_CHARS)} | ${cut(fact.attributeLabel, LABEL_CHARS)}: ${value}${wasOf(known)}`
    })
    return [`Groups in use: ${groups.length === 0 ? "none" : groups.join("; ")}`, "Facts:", ...lines].join("\n")
}

/** Whether a value is a record. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A value as a record, or null. */
const recordOf = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null)

/** A field as a cut text. */
const textOf = (value: unknown, chars: number): string => (typeof value === "string" ? cut(value, chars) : "")

/**
 * The judgements of one answer by the index of their fact in the batch. An item with no valid index, no boolean `policy`, or a policy
 * with no title or group is dropped (its fact stays to be judged); a second item for the same fact is ignored.
 */
export const judgementsOf = (json: unknown, count: number): ReadonlyMap<number, PolicyJudgement> => {
    const list = Array.isArray(json) ? json : (recordOf(json)?.items ?? recordOf(json)?.facts)
    const found = new Map<number, PolicyJudgement>()
    if (!Array.isArray(list)) return found
    list.forEach((item: unknown) => {
        const one = recordOf(item)
        const index = one?.i
        if (one === null || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= count) return
        if (found.has(index) || typeof one.policy !== "boolean") return
        const title = textOf(one.title, TITLE_MAX)
        const group = textOf(one.group, GROUP_MAX)
        const reason = textOf(one.reason, REASON_MAX)
        if (one.policy && (title === "" || group === "" || groupKeyOf(group) === "")) return
        found.set(index, one.policy ? { policy: true, title, group, reason } : { policy: false, title: "", group: "", reason })
    })
    return found
}

/** The batches of one pass: at most `DERIVE_MAX_CALLS` of `DERIVE_BATCH` facts, new truths first, in a stable order. */
export const deriveBatchesOf = (ask: ReadonlyArray<DeriveAsk>): ReadonlyArray<ReadonlyArray<DeriveAsk>> => {
    const ordered = ask.toSorted(
        (a, b) =>
            Number(a.known !== null) - Number(b.known !== null) ||
            a.fact.subjectKey.localeCompare(b.fact.subjectKey) ||
            a.fact.attribute.localeCompare(b.fact.attribute) ||
            a.fact.id.localeCompare(b.fact.id),
    )
    const batches: Array<ReadonlyArray<DeriveAsk>> = []
    for (let from = 0; from < ordered.length && batches.length < DERIVE_MAX_CALLS; from += DERIVE_BATCH) {
        batches.push(ordered.slice(from, from + DERIVE_BATCH))
    }
    return batches
}
