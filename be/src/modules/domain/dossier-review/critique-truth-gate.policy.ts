import type { CriticAnswer, CritiqueState, NotDoneReason } from "./document-critic.contracts"
import {
    holdingPoint,
    namesAllOf,
    pointStateOf,
    storedOwnHashes,
    storedPointOf,
    wholeHeldHashes,
} from "./document-critic-reconcile.policy"
import type { DossierFindingEntity, SourceCritiqueEntity } from "./persistence/entities"

/**
 * What is told when the critic's verdict on a document changed (its critique ended, or one of its points was answered, skipped or
 * closed by a decision): the truths work settles the document's waiting truths again. Answers whether a settle was queued.
 */
export interface CritiqueChangedHook {
    /** The verdict on this document changed. */
    critiqued(workspaceId: string, sourceId: string): Promise<boolean>
}

/** An open point of the critic as the truths work reads it: the question the founder is asked, and what waits on it. */
export interface OpenFinding {
    /** The point (a dossier_findings row). */
    readonly id: string
    /** The group the founder reads (`CRITIC_GROUPS`). */
    readonly group: string
    /** The critic kind. */
    readonly kind: string
    /** high, medium or low. */
    readonly severity: string
    /**
     * True when the point keeps the truths it names out of force: ONLY a point of a produced kind (`holdingPoint`: a contradiction
     * raised by the rules, text addressed to an AI raised by the model). An open point of a removed kind is listed and holds nothing.
     */
    readonly holds: boolean
    /** The hashes of this document's passages it quotes. */
    readonly hashes: ReadonlyArray<string>
    /** The candidate truths it names: they wait tied to this point. */
    readonly factIds: ReadonlyArray<string>
    /**
     * True when the point names EVERY truth it is about (each line it quotes is a line a truth was read from): it holds exactly
     * `factIds`. False or absent: it holds its passages whole (`CritiqueTruthGate.held`).
     */
    readonly namesAll?: boolean
}

/** What the founder's answer to a point decided about one truth. */
export interface AnswerDecision {
    /** `confirmed`: he kept the document's truth as written; `corrected`: he typed the value that holds instead. */
    readonly kind: "confirmed" | "corrected"
    /** His display name, as his answer kept it. */
    readonly by: string
}

/**
 * The critic's points on one document version, as the truths work reads it (`DocumentCriticService.truthGateOf`). Both gates read
 * the same open HOLDING points (`holdingPoint`): the customer gate withholds every passage one quotes (`heldHashes`: a passage is
 * served whole or not at all); the truth gate is finer (D-R-3): a point that names every truth it is about holds those truths only
 * (`findings[].factIds`), and `held` keeps only the passages of the holding points that could not name them all. The critique's
 * state, its reviewed passages and the verdict fields stay in the shape for their readers but decide no truth (owner 2026-11-12: a
 * truth goes in force as soon as its own document is read, unless a contradiction names it).
 */
export interface CritiqueTruthGate {
    /** Where the critique stands; `none` when it was never asked for. */
    readonly state: CritiqueState | "none"
    /** Why it is not done, else null. */
    readonly reason: NotDoneReason | null
    /** The hashes (`passageTextHashOf`) of the passages a finished security read of the critique reviewed (shown; gates no truth). */
    readonly reviewed: ReadonlySet<string>
    /** The hashes quoted by an open holding point that does not name every truth it is about: all their truths wait. */
    readonly held: ReadonlySet<string>
    /** Per passage hash whose points are all answered in favour of the document, who answered. */
    readonly confirmedBy: ReadonlyMap<string, string>
    /** The open points, each with its group, severity, passages and the candidate truths it names. */
    readonly findings: ReadonlyArray<OpenFinding>
    /** Per truth id, what the founder's answer to a point decided about it: only these truths are settled by an answer. */
    readonly decided: ReadonlyMap<string, AnswerDecision>
    /** Passages of the document no finished critique reviewed yet. */
    readonly waitingPassages: number
    /** Kept in the shape only: the per-truth verification is deleted, so it is always empty. */
    readonly verdicts: ReadonlyMap<string, string>
    /** Kept in the shape only: always 0 (no truth waits for a verdict any more). */
    readonly unverifiedTruths: number
}

/** Per truth the founder kept by an answer, the kinds of question (rule keys) that answer was given to. */
const keptQuestionsOf = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlyMap<string, ReadonlySet<string>> => {
    const kept = new Map<string, Set<string>>()
    for (const row of rows) {
        const answer = answerOf(row)
        const factId = answer !== null && keepsDocument(answer) ? answer.factId : null
        if (factId === null || (row.params[ANSWERED_BY_PARAM] ?? "") === "") continue
        kept.set(factId, (kept.get(factId) ?? new Set<string>()).add(row.ruleKey))
    }
    return kept
}

/** The verdict of a document the critic was never asked about: nothing reviewed, nothing held. */
export const NO_TRUTH_GATE: CritiqueTruthGate = {
    state: "none",
    reason: null,
    reviewed: new Set(),
    held: new Set(),
    confirmedBy: new Map(),
    findings: [],
    decided: new Map(),
    waitingPassages: 0,
    verdicts: new Map(),
    unverifiedTruths: 0,
}

/** The param a point keeps of who answered it (the display name). */
export const ANSWERED_BY_PARAM = "answeredBy"

/** The founder's answer to a point, when he gave one (a point closed by a decision on the graph, or skipped, carries none). */
const answerOf = (row: DossierFindingEntity): CriticAnswer | null =>
    pointStateOf(row) === "answered" ? storedPointOf(row).answer : null

/** True when an answer keeps what the document says. */
const keepsDocument = (answer: CriticAnswer): boolean => answer.kind === "keep_document" || answer.kind === "pick"

/**
 * What the answers of the document's points decided, per truth: the kept truth is confirmed, the typed value is the correction. Only
 * an answer that kept WHO answered decides: an answer recorded before the answer was the decision (no name on it) left its value a
 * waiting proposal for the founder to approve, and it stays one.
 */
const decidedOf = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlyMap<string, AnswerDecision> => {
    const decided = new Map<string, AnswerDecision>()
    for (const row of rows) {
        const answer = answerOf(row)
        const by = row.params[ANSWERED_BY_PARAM] ?? ""
        if (answer === null || by === "") continue
        if (keepsDocument(answer) && answer.factId !== null) decided.set(answer.factId, { kind: "confirmed", by })
        const filed = storedPointOf(row).proposalFactId ?? ""
        if (answer.kind === "value" && filed !== "") decided.set(filed, { kind: "corrected", by })
    }
    return decided
}

/** Per passage hash, who answered when EVERY point that quotes it is answered in favour of the document. */
const confirmedByOf = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlyMap<string, string> => {
    const byHash = new Map<string, Array<DossierFindingEntity>>()
    for (const row of rows.filter((one) => pointStateOf(one) !== "gone")) {
        for (const hash of storedOwnHashes(row)) byHash.set(hash, [...(byHash.get(hash) ?? []), row])
    }
    const confirmed = new Map<string, string>()
    for (const [hash, points] of byHash) {
        const answers = points.map((point) => answerOf(point))
        if (answers.every((answer) => answer !== null && keepsDocument(answer))) {
            confirmed.set(hash, points.at(-1)?.params[ANSWERED_BY_PARAM] ?? "")
        }
    }
    return confirmed
}

/**
 * The truth gate of one document from its critique row and its stored points (`regate`'s own read): the open points with the truths
 * they name and whether each holds (`holdingPoint`), the passages held whole, and what the founder's answers decided. Nothing here
 * waits for a review or a verdict: a point of a removed kind is listed with `holds` false and holds no passage.
 */
export const truthGateOf = (
    row: SourceCritiqueEntity | null,
    points: ReadonlyArray<DossierFindingEntity>,
    foreign: ReadonlyArray<DossierFindingEntity> = [],
): CritiqueTruthGate => {
    if (row === null) return NO_TRUTH_GATE
    // `foreign`: the open HOLDING points of OTHER documents that name a waiting truth of this one (a contradiction names both truths
    // and is raised once, on the side critiqued first): they hold the truths they name here too, and nothing else of this document.
    const asked = foreign.filter((point) => pointStateOf(point) === "open" && holdingPoint(point))
    // The founder's answer that keeps a truth answers THAT question about it wherever it is asked: one truth can carry two points
    // of the same kind, and answering one must not leave the other holding the truth for ever. A point of ANOTHER kind is another
    // question and still holds it. By rule keys and ids only.
    const decided = decidedOf(points)
    const answeredAs = keptQuestionsOf(points)
    const stillAsks = (point: DossierFindingEntity, id: string): boolean => answeredAs.get(id)?.has(point.ruleKey) !== true
    const open = points.filter((point) => pointStateOf(point) === "open")
    return {
        state: row.state,
        reason: row.reason,
        reviewed: new Set(row.reviewedHashes),
        held: wholeHeldHashes(open),
        confirmedBy: confirmedByOf(points),
        findings: [...open, ...asked].map((point) => ({
            id: point.id,
            group: point.params.group ?? "",
            kind: point.params.shopKind ?? "",
            severity: point.severity,
            holds: holdingPoint(point),
            hashes: asked.includes(point) ? [] : storedOwnHashes(point),
            factIds: point.factIds.filter((id) => stillAsks(point, id)),
            namesAll: asked.includes(point) ? true : namesAllOf(point),
        })),
        decided,
        waitingPassages: row.waitingPassages,
        verdicts: new Map(),
        unverifiedTruths: 0,
    }
}

/** What the critic knows of a stored passage beyond its text: who may read its document, and what triage made of it. */
export interface PassageScope {
    /** The passage id. */
    readonly id: string
    /** `public` or `internal`, the document's level. */
    readonly visibility: string | null
    /** `rule`, `data`, `none`, or null while triage has not judged it. */
    readonly triage: string | null
}

/**
 * The passages of a document the critic spends NO model call on (the minimal set, owner 2026-11-11): those of an INTERNAL document
 * that triage judged `data` or `none`. No truth is read from them (only `rule` passages are extracted) and no customer is served them
 * (a customer read needs a public document), so neither gate needs their review; the deterministic rules still read every passage.
 * A PUBLIC document is reviewed whole: its passages are served to customers. A passage triage has not judged is never exempt.
 * Answers their ids.
 */
export const exemptPassageIds = (scopes: ReadonlyArray<PassageScope>): ReadonlySet<string> =>
    new Set(
        scopes
            .filter((scope) => scope.visibility === "internal" && (scope.triage === "data" || scope.triage === "none"))
            .map((scope) => scope.id),
    )
