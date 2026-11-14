import type { AgentViewScope } from "@modules/domain/agents"
import { inForce, unshadowed, visibleTo, type Evidence, type FactRecord } from "@modules/domain/brain-facts"
import { lensOf, type Audience } from "@modules/domain/knowledge"
import { catalogAudienceOf } from "@modules/domain/module-audiences"

/**
 * The view one call of a native Brain tool answers for: the same view `knowledge.search` uses, never a wider one. The workspace is
 * the gateway caller's; the module and the instance come from the caller's agent; the audience is the lens of the module, narrowed
 * to the customer when the call serves a conversation.
 */
export interface NativeView {
    /** The workspace of the gateway caller. */
    readonly workspaceId: string
    /** The module of the caller's agent. */
    readonly module: string
    /** `customer` sees public knowledge only. */
    readonly audience: Audience
    /** The installation of a multi-instance agent, else null (the shared knowledge only). */
    readonly installationId: string | null
    /** False when the module is not in the catalogue: its documents cannot be searched, its facts can be read. */
    readonly searchable: boolean
}

/** The subject types no Brain tool serves, whoever asks: the Brain page keeps them and MCP does not. */
const WITHHELD_SUBJECTS: ReadonlySet<string> = new Set(["customer", "person"])

/** The view of a call: the agent's scope under the lens policy; an unknown module reads as a customer-facing one. */
export const viewOfCall = (workspaceId: string, scope: AgentViewScope, conversationId: string | null): NativeView => {
    const moduleAudience = catalogAudienceOf(scope.module)
    const lens = lensOf({
        workspaceId,
        module: scope.module,
        moduleAudience: moduleAudience ?? "customer",
        ...(conversationId === null ? {} : { requestedAudience: "customer" as const }),
        installationId: scope.installationId,
    })
    return {
        workspaceId: lens.workspaceId,
        module: lens.module,
        audience: lens.audience,
        installationId: lens.installationId,
        searchable: moduleAudience !== null,
    }
}

/** True when a Brain tool may serve a fact of this subject type. */
export const isServed = (fact: Pick<FactRecord, "subjectType">): boolean => !WITHHELD_SUBJECTS.has(fact.subjectType)

/** A fact as every Brain tool answers it. */
export interface FactLine {
    /** The fact id. */
    readonly id: string
    /** The subject as people write it. */
    readonly subject: string
    /** The attribute as people write it. */
    readonly attribute: string
    /** The value as written. */
    readonly value: string
    /** The unit, or null. */
    readonly unit: string | null
    /** The value as a number, exactly as the store read it when it was written (a price "55.000 d" is 55000); null when it is not one. */
    readonly num: number | null
    /** How far the source is believed, 0 to 100. */
    readonly trust: number
}

/** The line of a fact: what it says and how far it is believed, no source and no scope. */
export const factLineOf = (fact: FactRecord): FactLine => ({
    id: fact.id,
    subject: fact.subjectLabel,
    attribute: fact.attributeLabel,
    value: fact.value,
    unit: fact.unit,
    num: fact.valueNumber,
    trust: fact.trust,
})

/** Whether a served value holds now (`in`), starts later (`later`) or has ended (`ended`), at the read's instant. */
export type ValueNow = "in" | "later" | "ended"

/**
 * Where a served fact comes from, words-free: who said it (`kind`, the fact's source: owner, manager, document, system, staff, customer,
 * ai), the label of its newest evidence (a document title, "Private chat with an agent"...) and when that evidence was given. A
 * customer-facing view never receives the label: a source label may name an internal document or room.
 */
export interface SourceLine {
    /** Who said it: the fact's source kind. */
    readonly kind: FactRecord["sourceKind"]
    /** The newest evidence's title or label; absent in a customer view. */
    readonly label?: string
    /** When that evidence was given (else when the value was decided or proposed). */
    readonly at: string
}

/** Another value of the same truth that says otherwise: in force too (`in`), or waiting for the founder (`wait`); `value` null = asks to stop it. */
export interface OtherValue {
    /** The other fact. */
    readonly id: string
    /** Its value, or null for a proposal to stop using the served one. */
    readonly value: string | null
    /** Its unit, or null. */
    readonly unit: string | null
    /** Where it comes from. */
    readonly src: SourceLine
    /** `in`: in force for this reader too; `wait`: a proposal no one decided yet. */
    readonly now: "in" | "wait"
}

/**
 * A fact as a Brain tool serves it (owner order 2026-11-11, item 2): what an agent needs to cite it and to doubt it, in compact names.
 * `src` where it comes from, `v` its version, `from`/`to` its validity (`from` = its stated start, else when it was decided), `now` whether
 * it holds at the read's instant, `pub` whether customers may know it, `disputed` the other values of the same truth (absent when none),
 * `next` the value approved to take over later (absent when none).
 */
export interface ServedLine extends FactLine {
    /** Where it comes from. */
    readonly src: SourceLine
    /** Its version, or null when the store never numbered it. */
    readonly v: number | null
    /** From when it holds. */
    readonly from: string
    /** Until when it holds, or null. */
    readonly to: string | null
    /** Whether it holds now. */
    readonly now: ValueNow
    /** Whether customers may know it (a public fact). */
    readonly pub: boolean
    /** The other values of the same truth that say otherwise; absent when none. */
    readonly disputed?: ReadonlyArray<OtherValue>
    /** The value approved to take over later; absent when none. */
    readonly next?: NextValue
}

/** The value approved to take over a served one later: what it says and from when. */
export interface NextValue {
    /** The value. */
    readonly value: string
    /** Its unit, or null. */
    readonly unit: string | null
    /** When it starts. */
    readonly from: string
}

/** What a served line is read against: the instant, whether the reader faces customers, and the other values of the same truths. */
export interface ServedContext {
    /** The read's instant, epoch ms. */
    readonly at: number
    /** The reader's view. */
    readonly view: Pick<NativeView, "audience" | "module" | "installationId">
    /** The other values of the served truths (`BrainFactsReadService.kinOf`), any scope: each is held to the view here. */
    readonly kin: ReadonlyArray<FactRecord>
    /** The ids among the served facts and their kin this view reads now (`readNowOf`): in force, visible, not shadowed. */
    readonly readNow: ReadonlySet<string>
}

/**
 * The ids of the facts a view reads now among some facts: active or scheduled, in force, inside the lens and not shadowed by another
 * value of the same truth (`unshadowed`: a started scheduled value over the active one, an instance's own value over the shop's).
 */
export const readNowOf = (
    facts: ReadonlyArray<FactRecord>,
    view: Pick<NativeView, "audience" | "module" | "installationId">,
    at: number,
): ReadonlySet<string> => {
    const once = new Map(facts.map((fact) => [fact.id, fact]))
    const candidates = [...once.values()].filter(
        (fact) =>
            (fact.status === "active" || fact.status === "scheduled") &&
            isServed(fact) &&
            inForce(fact, at) &&
            visibleTo(fact, view.audience, view.module, view.installationId),
    )
    return new Set(unshadowed(candidates, view.installationId).map((fact) => fact.id))
}

/** An instant as a tool line writes it: the day alone at midnight UTC, else to the minute (`2026-11-11T17:00Z`). */
export const instantOf = (iso: string): string => {
    const at = new Date(iso)
    if (Number.isNaN(at.getTime())) return iso
    const text = at.toISOString()
    return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : `${text.slice(0, 16)}Z`
}

/** Whether a value holds at this instant, starts later or has ended. */
export const valueNowOf = (fact: FactRecord, at: number): ValueNow => {
    if (inForce(fact, at)) return "in"
    return fact.validFrom !== null && Date.parse(fact.validFrom) > at ? "later" : "ended"
}

/** Where a fact comes from, for a view: its source kind, its newest evidence's label (never to a customer view) and date. */
export const sourceLineOf = (fact: FactRecord, customer: boolean): SourceLine => {
    const item = fact.evidence.at(-1)
    const at = instantOf(item?.at ?? fact.decidedAt ?? fact.proposedAt)
    const label = item?.title ?? item?.label
    return customer || label === undefined ? { kind: fact.sourceKind, at } : { kind: fact.sourceKind, label, at }
}

/** Whether two values of one truth say the same (value and unit, case and spacing aside). */
const sameSaid = (left: FactRecord, right: FactRecord): boolean =>
    `${left.value} ${left.unit ?? ""}`.trim().toLowerCase() === `${right.value} ${right.unit ?? ""}`.trim().toLowerCase()

/**
 * The other values of the served fact's truth that say otherwise, for this view: another value in force the view reads (any proposal
 * kind `set`, not shadowed away: two values both in force), and, for an internal view only, the waiting proposals of the same truth (a
 * value, or a request to stop it) and the waiting proposals that name it as possibly the same truth. A customer view never sees a
 * proposal nor a value it cannot read.
 */
const disputesOf = (fact: FactRecord, context: ServedContext): ReadonlyArray<OtherValue> => {
    const { view } = context
    const customer = view.audience === "customer"
    const sameTruth = (other: FactRecord): boolean =>
        other.subjectKey === fact.subjectKey && other.attribute === fact.attribute
    return context.kin.flatMap((other): ReadonlyArray<OtherValue> => {
        if (other.id === fact.id || !isServed(other)) return []
        if (context.readNow.has(other.id)) {
            return sameTruth(other) && other.proposalKind === "set" && !sameSaid(other, fact)
                ? [{ id: other.id, value: other.value, unit: other.unit, src: sourceLineOf(other, customer), now: "in" }]
                : []
        }
        if (customer || other.status !== "proposed") return []
        const scoped = other.installationId === null || other.installationId === fact.installationId
        const aboutIt = (sameTruth(other) && scoped) || other.conflictWith === fact.id
        if (!aboutIt) return []
        if (other.proposalKind === "retire") {
            return other.conflictWith === fact.id || other.conflictWith === null
                ? [{ id: other.id, value: null, unit: null, src: sourceLineOf(other, false), now: "wait" }]
                : []
        }
        return sameSaid(other, fact)
            ? []
            : [{ id: other.id, value: other.value, unit: other.unit, src: sourceLineOf(other, false), now: "wait" }]
    })
}

/** The value approved to take over the served fact later: a scheduled value of its truth and scope whose start has not come. */
const nextOf = (fact: FactRecord, context: ServedContext): NextValue | undefined => {
    const later = context.kin
        .filter(
            (other) =>
                other.status === "scheduled" &&
                other.subjectKey === fact.subjectKey &&
                other.attribute === fact.attribute &&
                other.installationId === fact.installationId &&
                visibleTo(other, context.view.audience, context.view.module, context.view.installationId) &&
                valueNowOf(other, context.at) === "later",
        )
        .sort((left, right) => Date.parse(left.validFrom ?? "") - Date.parse(right.validFrom ?? ""))[0]
    const from = later?.validFrom ?? null
    return later === undefined || from === null ? undefined : { value: later.value, unit: later.unit, from: instantOf(from) }
}

/** A fact as a Brain tool serves it to this view: its line, source, version, validity, audience, disputes and the value to come. */
export const servedLineOf = (fact: FactRecord, context: ServedContext): ServedLine => {
    const customer = context.view.audience === "customer"
    const disputed = disputesOf(fact, context)
    const next = nextOf(fact, context)
    return {
        ...factLineOf(fact),
        src: sourceLineOf(fact, customer),
        v: fact.version ?? null,
        from: instantOf(fact.validFrom ?? fact.decidedAt ?? fact.proposedAt),
        to: fact.validTo === null ? null : instantOf(fact.validTo),
        now: valueNowOf(fact, context.at),
        pub: visibleTo(fact, "customer", "", fact.installationId),
        ...(disputed.length === 0 ? {} : { disputed }),
        ...(next === undefined ? {} : { next }),
    }
}

/** What supports a fact, as a tool answers it: the kind and the label only. `quote`, `ref` and `connectionId` are dropped. */
export interface EvidenceLine {
    /** The kind of evidence. */
    readonly kind: string
    /** A short label for people. */
    readonly label: string
}

/** The evidence of a fact as kind and label; a customer-facing view gets the kind only (a label may name an internal document or room). */
export const evidenceLinesOf = (
    evidence: ReadonlyArray<Evidence>,
    customer = false,
): ReadonlyArray<EvidenceLine | Pick<EvidenceLine, "kind">> =>
    evidence.map((item) => (customer ? { kind: item.kind } : { kind: item.kind, label: item.label }))
