import { createHash } from "node:crypto"
import { foldText } from "./document-state.policy"
import {
    CRITIC_CAPS,
    GROUP_OF,
    STORED_KIND_OF,
    criticKindOfRule,
    criticRuleKey,
    type CriticAgainst,
    type CriticAnswer,
    type CriticChoice,
    type CriticPoint,
    type CriticQuote,
    type CriticTarget,
    type PointState,
} from "./document-critic.contracts"
import { ownHashesOf } from "./document-critic-rules.policy"
import { DOSSIER_REVIEW_CAPS, type FindingEvidence } from "./dossier-review.contracts"
import { evidenceHashOf } from "./fingerprint.policy"
import type { DossierFindingEntity } from "./persistence/entities"

/** The note a point takes when its passage is no longer in the document, and when the rules no longer find it. */
export const GONE_NOTES = { gone: "no longer in the document", notFound: "no longer detected" } as const

const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 32)

/** The identity of a point within its workspace: the document, the kind, what it is about and the passages it quotes (by hash, so a re-upload that keeps a passage keeps the point). */
export const criticFingerprintOf = (sourceId: string, point: CriticPoint): string =>
    hashOf(`shop|${sourceId}|${point.kind}|${point.subject}|${ownHashesOf(point)}`)

/** The hashes of this document's passages a stored point quotes. */
export const storedOwnHashes = (row: Pick<DossierFindingEntity, "evidence">): ReadonlyArray<string> =>
    row.evidence.flatMap((item) => (item.role === "claim" && typeof item.chunkHash === "string" ? [item.chunkHash] : []))

const toEvidence = (quote: CriticQuote): FindingEvidence => ({
    role: quote.role === "this" ? "claim" : "counter",
    label: quote.sourceTitle ?? "",
    sourceId: quote.sourceId,
    sourceTitle: quote.sourceTitle,
    passageId: quote.passageId,
    factId: quote.factId,
    factLine: null,
    quote: quote.text.slice(0, DOSSIER_REVIEW_CAPS.quoteMax),
    chunkHash: quote.chunkHash,
})

/** The string params a stored point carries: the critic's own fields, JSON where they are structured. */
export interface CriticParams {
    /** The critic kind. */
    readonly shopKind: string
    /** The founder-facing group. */
    readonly group: string
    /** The document. */
    readonly sourceId: string
    /** The question to the founder. */
    readonly question: string
    /** The choices, JSON. */
    readonly choices: string
    /** What it is compared with, JSON or "". */
    readonly against: string
    /** What it is about. */
    readonly subject: string
    /** Where a typed answer is filed when no fact stands for the point, JSON or "". */
    readonly target: string
}

const paramsOf = (sourceId: string, point: CriticPoint): Record<string, string> => {
    const params: CriticParams = {
        shopKind: point.kind,
        group: GROUP_OF[point.kind],
        sourceId,
        question: point.question.slice(0, 300),
        choices: JSON.stringify(point.choices),
        against: point.against === null ? "" : JSON.stringify(point.against),
        subject: point.subject.slice(0, 200),
        target: point.target === undefined || point.target === null ? "" : JSON.stringify(point.target),
    }
    return { ...params }
}

/** The columns a point writes on its row, new or refreshed (never its state). */
export const pointColumns = (
    sourceId: string,
    point: CriticPoint,
): Pick<
    DossierFindingEntity,
    | "kind"
    | "severity"
    | "origin"
    | "ruleKey"
    | "code"
    | "params"
    | "title"
    | "detail"
    | "evidence"
    | "evidenceHash"
    | "sourceIds"
    | "factIds"
    | "remedyAction"
    | "remedyDocumentType"
    | "dossierId"
    | "relatedDossierIds"
> => {
    const evidence = point.quotes.slice(0, DOSSIER_REVIEW_CAPS.evidenceMax).map(toEvidence)
    return {
        kind: STORED_KIND_OF[point.kind],
        severity: point.severity,
        origin: point.origin,
        ruleKey: criticRuleKey(point.kind),
        code: null,
        params: paramsOf(sourceId, point),
        title: point.line.slice(0, DOSSIER_REVIEW_CAPS.titleMax),
        detail: point.why.slice(0, DOSSIER_REVIEW_CAPS.detailMax),
        evidence,
        evidenceHash: evidenceHashOf(evidence),
        sourceIds: [...new Set([sourceId, ...evidence.flatMap((item) => (item.sourceId === null ? [] : [item.sourceId]))])].sort(),
        factIds: [...new Set(evidence.flatMap((item) => (item.factId === null ? [] : [item.factId])))].sort(),
        remedyAction: "decide",
        remedyDocumentType: null,
        dossierId: null,
        relatedDossierIds: [],
    }
}

/** A point with its identity. */
export interface KeyedPoint {
    /** The point. */
    readonly point: CriticPoint
    /** Its fingerprint. */
    readonly fingerprint: string
}

/** What a critique reconciles against. */
export interface CriticReconcileInput {
    /** The document. */
    readonly sourceId: string
    /** The stored points of this document. */
    readonly stored: ReadonlyArray<DossierFindingEntity>
    /** What the rules and the model found now. */
    readonly found: ReadonlyArray<KeyedPoint>
    /** The hashes of the document's passages now. */
    readonly present: ReadonlySet<string>
    /** The hashes the model read in this critique (empty when the model did not run). */
    readonly reread: ReadonlySet<string>
}

/** A change to a stored point. */
export interface CriticChange {
    /** The row id. */
    readonly id: string
    /** The columns. */
    readonly changes: Partial<DossierFindingEntity>
}

/** What a critique writes. */
export interface CriticReconciliation {
    /** New points. */
    readonly inserts: ReadonlyArray<KeyedPoint>
    /** Changes to stored points. */
    readonly changes: ReadonlyArray<CriticChange>
}

const isActive = (row: DossierFindingEntity): boolean => row.status === "open" || row.status === "confirmed"

const closed = (now: Date, note: string): Partial<DossierFindingEntity> => ({
    status: "resolved",
    resolution: "not_detected",
    resolvedAt: now,
    decisionNote: note,
    lastSeenAt: now,
})

/** One stored point the critique did not find again. */
const unseen = (row: DossierFindingEntity, input: CriticReconcileInput, now: Date): CriticChange | null => {
    if (!isActive(row)) return null
    const own = storedOwnHashes(row)
    if (own.some((hash) => !input.present.has(hash))) return { id: row.id, changes: closed(now, GONE_NOTES.gone) }
    if (row.origin === "rule") return { id: row.id, changes: closed(now, GONE_NOTES.notFound) }
    // A model point is closed only when the model read its passage again and did not raise it; never by being forgotten.
    if (own.some((hash) => input.reread.has(hash))) return { id: row.id, changes: closed(now, GONE_NOTES.notFound) }
    return null
}

/** One stored point found again: refreshed while open; an answered or skipped point keeps its state; a closed-as-gone point opens again. */
const seen = (row: DossierFindingEntity, found: KeyedPoint, sourceId: string, now: Date): CriticChange => {
    const columns = pointColumns(sourceId, found.point)
    if (isActive(row)) return { id: row.id, changes: { ...columns, params: { ...row.params, ...columns.params }, lastSeenAt: now } }
    const answeredOrSkipped = row.status === "dismissed" || (row.status === "resolved" && row.resolution === "manual")
    if (answeredOrSkipped) return { id: row.id, changes: { lastSeenAt: now } }
    return {
        id: row.id,
        changes: {
            ...columns,
            status: "open",
            resolution: null,
            resolvedAt: null,
            reopenedCount: row.reopenedCount + 1,
            decisionNote: "re-detected",
            lastSeenAt: now,
        },
    }
}

/**
 * Sets the stored points of one document against what the critique found: a new point is inserted; a point found again keeps the state the
 * founder gave it (answered and skipped points stay as they are, open ones are refreshed); a point whose passage is no longer in the
 * document closes itself as "no longer in the document"; a rule point the rules (which read the whole document) no longer find closes;
 * a model point closes only when the model read its passage again.
 */
export const reconcileCritique = (input: CriticReconcileInput, now: Date): CriticReconciliation => {
    const byFingerprint = new Map(input.found.map((item) => [item.fingerprint, item]))
    const stored = new Set(input.stored.map((row) => row.fingerprint))
    const changes = input.stored.flatMap((row) => {
        const found = byFingerprint.get(row.fingerprint)
        const change = found === undefined ? unseen(row, input, now) : seen(row, found, input.sourceId, now)
        return change === null ? [] : [change]
    })
    return { inserts: [...byFingerprint.values()].filter((item) => !stored.has(item.fingerprint)), changes }
}

/** The state of a stored point as the founder reads it. */
export const pointStateOf = (row: Pick<DossierFindingEntity, "status" | "resolution">): PointState => {
    if (row.status === "open" || row.status === "confirmed") return "open"
    if (row.status === "dismissed") return "skipped"
    return row.resolution === "manual" ? "answered" : "gone"
}

const parsed = <T>(text: string | undefined, fallback: T): T => {
    if (text === undefined || text === "") return fallback
    try {
        return JSON.parse(text) as T
    } catch {
        return fallback
    }
}

/** A stored point read back: what the API lists. */
export interface StoredPoint {
    /** The row id. */
    readonly id: string
    /** The critic kind. */
    readonly kind: ReturnType<typeof criticKindOfRule>
    /** Its choices. */
    readonly choices: ReadonlyArray<CriticChoice>
    /** What it is compared with. */
    readonly against: CriticAgainst | null
    /** The question. */
    readonly question: string
    /** The answer given, when any. */
    readonly answer: CriticAnswer | null
    /** The waiting proposal it became. */
    readonly proposalFactId: string | null
    /** The document. */
    readonly sourceId: string | null
    /** Where a typed answer is filed when no fact stands for the point. */
    readonly target: CriticTarget | null
}

/** The critic fields of a stored row. */
export const storedPointOf = (row: DossierFindingEntity): StoredPoint => ({
    id: row.id,
    kind: criticKindOfRule(row.ruleKey),
    choices: parsed<ReadonlyArray<CriticChoice>>(row.params.choices, []),
    against: parsed<CriticAgainst | null>(row.params.against, null),
    question: row.params.question ?? "",
    answer: parsed<CriticAnswer | null>(row.params.answer, null),
    proposalFactId: row.params.proposalFactId ?? null,
    sourceId: row.params.sourceId ?? null,
    target: parsed<CriticTarget | null>(row.params.target, null),
})

/** The folded subject of a model point: its first quote of this document. */
export const modelSubjectOf = (quotes: ReadonlyArray<CriticQuote>): string =>
    foldText(quotes.find((quote) => quote.role === "this")?.text ?? "").slice(0, 120)

/** The hashes held back from customers: those quoted by an open HIGH point. */
export const heldHashes = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlySet<string> =>
    new Set(rows.filter((row) => isActive(row) && (row.severity === "high" || row.severity === "critical")).flatMap(storedOwnHashes))

/** The longest quote a critic point stores. */
export const CRITIC_QUOTE_MAX = CRITIC_CAPS.quoteMax
