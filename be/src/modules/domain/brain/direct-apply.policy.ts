import { sameValue, valueLineOf, type FactRecord } from "@modules/domain/brain-facts"
import type { AnswerDecision, OpenFinding } from "@modules/domain/dossier-review"

/** The token of the critic's verdict on the passages of a document, as the truths work reads it. */
export const TRUTH_CRITIQUE_GATE: unique symbol = Symbol("domain.brain.truth-critique-gate")

/**
 * The critic's word on the passages of one document. It serves what customers may be served (`knowledge_chunks.customer_ready`) and,
 * for the truths, ONLY its holding points (owner 2026-11-12: the critique covers duplicates, contradictions between data or sources,
 * and text addressed to an AI): `findings[].holds` is true only for a contradiction point or an addressed-to-AI point, and `held` is
 * the passages under such a point. The settle never waits for a critique: `state`, `reviewed` and `waitingPassages` are shown, never
 * read for a decision.
 */
export interface PassageCritique {
    /** Where the critique of the document stands; `none` when it was never asked for. */
    readonly state: "none" | "waiting" | "running" | "done" | "not_done"
    /** The hashes (`passageTextHashOf`) of the passages a finished critique read. */
    readonly reviewed: ReadonlySet<string>
    /** The hashes quoted by an open point of a holding severity: the founder is asked, nothing of them goes in force. */
    readonly held: ReadonlySet<string>
    /** Per passage hash whose points are all answered in favour of the document, who answered (shown; the settle reads `decided`). */
    readonly confirmedBy: ReadonlyMap<string, string>
    /** Why the critique is not done (`credits`, `budget`, `model`, `facts_unread`), else null. */
    readonly reason?: string | null
    /** The open points: each is ONE question to the founder, with its group, severity, passages and the candidate truths it names. */
    readonly findings?: ReadonlyArray<OpenFinding>
    /** Per truth id, what the founder's answer to a point decided about it: an answer settles only the truths it names. */
    readonly decided?: ReadonlyMap<string, AnswerDecision>
    /** Passages of the document no finished critique reviewed yet. */
    readonly waitingPassages?: number
}


/** What reads the critic's verdict; the dossier review provides it (`DocumentCriticService.truthGateOf`). */
export interface TruthCritiqueGate {
    /** The verdict on the passages of a document. */
    truthGateOf(workspaceId: string, sourceId: string): Promise<PassageCritique>
}

/** The verdict when no critic is there to ask: no point holds anything, so the truths settle by their own rule. */
export const NO_CRITIQUE: PassageCritique = { state: "none", reviewed: new Set(), held: new Set(), confirmedBy: new Map() }

/**
 * What settling does with one waiting truth of a document:
 * - `apply`: in force directly, with the document's trust;
 * - `confirmed`: in force as an owner-confirmed version: the founder answered the point that names it "keep the document";
 * - `corrected`: in force as the founder's own value: he answered the point with the value that holds instead;
 * - `updated`: in force as the next version of the value THIS document put in force before (the document updated itself);
 * - `duplicate`: the same truth with the same value already stands under other words: closed, nothing asked;
 * - `asked`: the founder is asked (a contradiction, or an open holding point names it): it waits for his answer;
 * - `waiting`: no member of the workspace stands behind the document (a sync, an API key): it waits for a person.
 */
export type SettleVerdict = "apply" | "confirmed" | "corrected" | "updated" | "duplicate" | "asked" | "waiting"

/** What the verdict of one waiting truth is decided from. */
export interface SettleContext {
    /** The document. */
    readonly sourceId: string
    /** True when a current member of the workspace (owner, manager or staff) uploaded the document, or approved it when public. */
    readonly memberDocument: boolean
    /** The critic's word on the document's passages: only its holding points are read. */
    readonly critique: PassageCritique
    /** How many OTHER values that wait for the same key and scope ARGUE with this one (`arguesWith`). */
    readonly rivals: number
    /** How many values in force for the same key and scope argue with this one and were NOT put in force by this document. */
    readonly inForce: number
    /** True when the only values in force that argue with this one were put in force by this same document (`putInForceBy`). */
    readonly updates?: boolean
    /** True when the truth `conflictWith` names sits on this truth's own key: the key's rules above decide, not the name. */
    readonly conflictOnKey?: boolean
    /** The truth the same-meaning judgement named, when it did and the truth still exists. */
    readonly sameAs: FactRecord | null
    /**
     * True when another waiting truth of the SAME document (any of its parts) names this one as the truth it disagrees with: the
     * document contradicts itself in other words, so neither value goes in force and the founder is asked once.
     */
    readonly contested?: boolean
    /** True when the value does not read as the type of the value in force it would replace (`valueTypeProblemOf`). */
    readonly typeProblem?: boolean
}

/** The hash of the passage of the document a truth was read from, or null when its evidence names none. */
export const passageHashOf = (fact: FactRecord, sourceId: string): string | null =>
    fact.evidence.find((item) => item.kind === "document" && item.sourceId === sourceId && item.chunkHash !== undefined)
        ?.chunkHash ?? null

/**
 * Whether a truth's end is the DEFAULT one a truth in force takes when nobody stated an end (owner 2026-11-10, truth-graph: "every truth
 * defaults to ONE YEAR unless a shorter period is stated"; `brain-facts/fact-write.policy.ts` `DEFAULT_VALID_TO`): exactly one calendar
 * year after its start. Such a truth is a STANDING value, not a window.
 */
const defaultEnd = (fact: Pick<FactRecord, "validFrom" | "validTo">): boolean => {
    if (fact.validFrom === null || fact.validTo === null) return false
    const year = new Date(fact.validFrom)
    year.setUTCFullYear(year.getUTCFullYear() + 1)
    return year.getTime() === Date.parse(fact.validTo)
}

/** Whether a truth states a window: it has a stated end (the one-year default of a truth in force is no stated end). */
const windowed = (fact: FactRecord): boolean => fact.validTo !== null && !defaultEnd(fact)

/**
 * Whether a waiting truth is an OVERLAY of another truth (D-N-5): it states a window and the other is a standing value (open-ended, or
 * with the default end of a truth in force). A holiday fee over the everyday fee, "10 % until 30/11" over the standing 5 %: the window
 * applies, and the standing value comes back after it (`BrainFactsService` schedules it). It never argues (`arguesWith`), whether the
 * two share a key or the same-meaning judgement linked them across two keys.
 */
export const overlays = (fact: FactRecord, standing: FactRecord): boolean => windowed(fact) && !windowed(standing)

/** The start and end of a truth's validity as instants (open ends are infinite). */
const spanOf = (fact: FactRecord): readonly [number, number] => [
    fact.validFrom === null ? Number.NEGATIVE_INFINITY : Date.parse(fact.validFrom),
    fact.validTo === null ? Number.POSITIVE_INFINITY : Date.parse(fact.validTo),
]

/**
 * Whether a waiting value ARGUES with another value of its key (a contradiction the founder is asked about). The same value never
 * does. A value with a stated window over an open-ended one (or over one in force with the default one-year end) is an OVERLAY, not
 * a contradiction: a holiday surcharge or "10 % until
 * 30/11" applies for its window and the standing value is in force again after it (`BrainFactsService` schedules it back). Two
 * windows argue only when they overlap. An open-ended value argues with any other value in force, and with an open-ended one that
 * waits; an open-ended value and a window that both wait (one document stating both) do not argue: both apply.
 */
export const arguesWith = (fact: FactRecord, other: FactRecord, otherInForce: boolean): boolean => {
    if (sameValue(valueLineOf(other), valueLineOf(fact))) return false
    if (windowed(fact) && windowed(other)) {
        const [from, to] = spanOf(fact)
        const [otherFrom, otherTo] = spanOf(other)
        return from < otherTo && otherFrom < to
    }
    if (windowed(fact)) return false
    return otherInForce || !windowed(other)
}

/** The notes under which the settle of a document puts a truth in force, by verdict. */
const SETTLE_NOTES = ["direct", "confirmed", "updated"] as const

/**
 * Whether a value in force was put there by THIS document and still stands as the document left it: a document truth whose decision
 * note names the document. A value the founder edited since, or another source superseded, is a new version with another note.
 */
export const putInForceBy = (inForce: FactRecord, sourceId: string): boolean =>
    inForce.sourceKind === "document" &&
    SETTLE_NOTES.some((note) => inForce.decisionNote?.startsWith(`${note}:${sourceId}`) === true) &&
    // TRIAGE-4: only a value THIS document alone stands behind is its own to update; once another source joined it (a duplicate merged
    // into it), replacing it would silently overrule that source too, so it is asked.
    inForce.evidence.every((item) => item.kind !== "document" || item.sourceId === sourceId)

/** True when an open holding point (a contradiction, or text addressed to an AI) names the truth: the point is the question. */
const namedByHoldingPoint = (fact: FactRecord, critique: PassageCritique): boolean =>
    (critique.findings ?? []).some((finding) => finding.holds && finding.factIds.includes(fact.id))

/**
 * The verdict a truth gets from the truth it names in `conflictWith` (another key), or null when that name decides nothing: the same
 * value under other words is a duplicate; a window the judge linked to a standing value is its overlay and the gate goes on (D-N-5);
 * anything else is a contradiction and asked.
 */
const namedVerdictOf = (fact: FactRecord, context: SettleContext): SettleVerdict | null => {
    if (fact.conflictWith === null || context.conflictOnKey === true) return null
    const sameAs = (fact.flags ?? []).includes("same_meaning") ? context.sameAs : null
    if (sameAs === null) return "asked"
    if (sameValue(valueLineOf(sameAs), valueLineOf(fact))) return "duplicate"
    return overlays(fact, sameAs) ? null : "asked"
}

/** The verdict of a truth the founder's answer to a point decided. */
const decidedVerdictOf = (fact: FactRecord, context: SettleContext, decision: AnswerDecision): SettleVerdict => {
    if (fact.proposalKind !== "set" || context.typeProblem === true) return "asked"
    if (namedByHoldingPoint(fact, context.critique)) return "asked"
    return decision.kind
}

/**
 * THE GATE of direct apply, the whole rule in one place (owner 2026-11-12: documents are entered by the business's own people and are
 * trusted). A waiting truth of a member's document goes in force BY ITSELF as soon as its own document (or part) is read, unless:
 * (a) a CONTRADICTION: it names a truth it disagrees with under another key (`conflictWith`, the same-meaning judgement: the same
 *     value is a duplicate and closes, a window over a standing value is its overlay and goes on); another value that ARGUES with it
 *     waits for its key (two documents, `rivals`), is in force for its key from another source (`inForce`), or the same document gives
 *     it another value under other words (`contested`). A stated window over a standing value is an overlay and argues with nothing
 *     (`arguesWith`); a value in force that THIS document put there is its own to update (`putInForceBy`: `updated`, no question);
 * (b) an open HOLDING point names it or holds its passage (`findings[].holds`, `held`: a contradiction point, or text addressed to an
 *     AI found before it settled).
 * Nothing else asks: no flag (`stale`; `period_unclear`: a period that could not be computed is filed without one and takes the
 * default validity), no point of another kind, no passage the critic has not read, no truth without a passage. A window already over
 * is not asked about either: the store records it as history, never as the value in force (`BrainFactsService.apply`). A truth to
 * stop using a value (`retire`) sets no value and is asked.
 *
 * The founder's ANSWER to a point is the decision for the truths that answer names, and only for them (`critique.decided`): such a
 * truth goes in force as decided by him even over a contradiction (that was the question he answered), unless another open holding
 * point still names it or its value is not of the type of the truth it replaces.
 */
export const settleVerdictOf = (fact: FactRecord, context: SettleContext): SettleVerdict => {
    if (!context.memberDocument) return "waiting"
    const decision = context.critique.decided?.get(fact.id)
    if (decision !== undefined) return decidedVerdictOf(fact, context, decision)
    if (fact.proposalKind !== "set") return "asked"
    const named = namedVerdictOf(fact, context)
    if (named !== null) return named
    if (context.rivals > 0 || context.inForce > 0 || context.contested === true) return "asked"
    const hash = passageHashOf(fact, context.sourceId)
    if ((hash !== null && context.critique.held.has(hash)) || namedByHoldingPoint(fact, context.critique)) return "asked"
    return context.updates === true ? "updated" : "apply"
}
