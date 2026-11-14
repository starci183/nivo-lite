import { createHash } from "node:crypto"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { foldText } from "./text-fold.policy"
import {
    ANSWER_KINDS,
    CRITIC_CAPS,
    GROUP_OF,
    STORED_KIND_OF,
    criticKindOfRule,
    criticRuleKey,
    isProducedKind,
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
import { evidenceHashOf } from "./evidence.policy"
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
    /** "true" when every line the point quotes from this document gave a truth: it holds only the truths it names (D-R-3). */
    readonly namesAll: string
}

/** The param of a stored point that says it names every truth it is about. */
export const NAMES_ALL_PARAM = "namesAll"

/** True when a stored point holds only the truths it names (a point stored before the param existed holds its passages whole). */
export const namesAllOf = (row: Pick<DossierFindingEntity, "params">): boolean => row.params[NAMES_ALL_PARAM] === "true"

/**
 * The param an OLD point carries when it was the verdict of the deleted per-truth verification (stored rows only: nothing writes it
 * any more). Such a point is a point of a removed kind: it holds nothing and closes at its document's next critique.
 */
export const VERDICT_OF_PARAM = "verdictOf"

/** True when a stored point was a verdict of the deleted verification (an old row). */
const isOldVerdict = (row: Pick<DossierFindingEntity, "params">): boolean => (row.params[VERDICT_OF_PARAM] ?? "") !== ""

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
        namesAll: point.namesAll === true ? "true" : "false",
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
    const evidence = point.quotes.slice(0, DOSSIER_REVIEW_CAPS.evidenceMax).map((quote) => toEvidence(quote))
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
        sourceIds: [...new Set([sourceId, ...evidence.flatMap((item) => (item.sourceId === null ? [] : [item.sourceId]))])].sort((a, b) => a.localeCompare(b)),
        factIds: [...new Set([...evidence.flatMap((item) => (item.factId === null ? [] : [item.factId])), ...(point.names ?? [])])].sort((a, b) => a.localeCompare(b)),
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

/** The row a new point is stored as. */
export type NewPointRow = ReturnType<typeof pointColumns> & Pick<DossierFindingEntity, "workspaceId" | "fingerprint" | "firstSeenAt" | "lastSeenAt">

/** The rows of the new points of a document, first seen now. */
export const newPointRows = (workspaceId: string, sourceId: string, inserts: ReadonlyArray<KeyedPoint>, now: Date): Array<NewPointRow> =>
    inserts.map((item) => ({
        ...pointColumns(sourceId, item.point),
        workspaceId,
        fingerprint: item.fingerprint,
        firstSeenAt: now,
        lastSeenAt: now,
    }))

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

const isActive = (row: Pick<DossierFindingEntity, "status">): boolean => row.status === "open" || row.status === "confirmed"

/**
 * The severities a point of a produced kind holds with (every produced kind is raised high or medium; a LOW point lets its passage
 * through).
 */
export const HOLDING_SEVERITIES: ReadonlySet<string> = new Set(["critical", "high", "medium"])

/**
 * THE ONE TEST of whether a stored point may hold anything: its kind is still produced, by the side that produces it
 * (`isProducedKind`: a contradiction raised by the rules, text addressed to an AI raised by the model), it is no verdict of the
 * deleted verification, and its severity holds. Every holding read goes through it: the truth gate's `holds` and `held`, the
 * customer gate (`heldHashes`), the read side's count of held passages. By kind, origin, params and severity only.
 */
export const holdingPoint = (row: Pick<DossierFindingEntity, "ruleKey" | "origin" | "params" | "severity">): boolean =>
    isProducedKind(criticKindOfRule(row.ruleKey), row.origin) && !isOldVerdict(row) && HOLDING_SEVERITIES.has(row.severity)

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
    // A point of a removed kind (an old typo, vague, template ... point, an old verdict, a contradiction the old model read) is
    // never raised again: it closes at this critique (D5), whoever raised it.
    if (row.origin === "rule" || !isProducedKind(criticKindOfRule(row.ruleKey), row.origin) || isOldVerdict(row))
        return { id: row.id, changes: closed(now, GONE_NOTES.notFound) }
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
 * a point of a removed kind closes (`not_detected`, D5); a model point of the produced kind closes only when the model read its
 * passage again.
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

/** True when a value is a string or null. */
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

const isAnswerKind = (kind: string): boolean => {
    const kinds: ReadonlyArray<string> = ANSWER_KINDS
    return kinds.includes(kind)
}

const isAnswer = (value: unknown): value is CriticAnswer =>
    isRecord(value) &&
    typeof value.kind === "string" &&
    isAnswerKind(value.kind) &&
    isTextOrNull(value.factId) &&
    isTextOrNull(value.value)

const isChoice = (value: unknown): value is CriticChoice =>
    isRecord(value) &&
    (value.id === "a" || value.id === "b") &&
    typeof value.label === "string" &&
    typeof value.needsInput === "boolean" &&
    isTextOrNull(value.inputHint) &&
    isAnswer(value.answer)

const isChoices = (value: unknown): value is ReadonlyArray<CriticChoice> => Array.isArray(value) && value.every((item) => isChoice(item))

const isAgainst = (value: unknown): value is CriticAgainst | null =>
    value === null ||
    (isRecord(value) &&
        (value.kind === "truth" || value.kind === "proposal" || value.kind === "document") &&
        typeof value.value === "string" &&
        isTextOrNull(value.sourceTitle) &&
        isTextOrNull(value.factId))

const isAnswerOrNull = (value: unknown): value is CriticAnswer | null => value === null || isAnswer(value)

const isTarget = (value: unknown): value is CriticTarget | null =>
    value === null || (isRecord(value) && typeof value.subjectLabel === "string" && typeof value.attributeLabel === "string")

/** The stored JSON text read back as the shape `isShape` accepts, else the fallback (a text that does not parse, or has another shape, is the fallback). */
const parsed = <T>(text: string | undefined, fallback: T, isShape: (value: unknown) => value is T): T => {
    if (text === undefined || text === "") return fallback
    const read = parseJsonText(text)
    return read.ok && isShape(read.value) ? read.value : fallback
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
    choices: parsed<ReadonlyArray<CriticChoice>>(row.params.choices, [], isChoices),
    against: parsed<CriticAgainst | null>(row.params.against, null, isAgainst),
    question: row.params.question ?? "",
    answer: parsed<CriticAnswer | null>(row.params.answer, null, isAnswerOrNull),
    proposalFactId: row.params.proposalFactId ?? null,
    sourceId: row.params.sourceId ?? null,
    target: parsed<CriticTarget | null>(row.params.target, null, isTarget),
})

/** The folded subject of a model point: its first quote of this document. */
export const modelSubjectOf = (quotes: ReadonlyArray<CriticQuote>): string =>
    foldText(quotes.find((quote) => quote.role === "this")?.text ?? "").slice(0, 120)

/** True when a stored point offers the founder nothing to choose: text addressed to the AI, or a roll-up of many points. */
const offersNoChoice = (row: Pick<DossierFindingEntity, "params">): boolean => {
    const choices = row.params.choices ?? ""
    return choices === "" || choices === "[]"
}

/**
 * The hashes whose truths ALL wait (the truth gate). A finding holds only the truths it names (`OpenFinding.factIds`), so a point
 * about a line no truth was read from holds no truth. Two holding points still hold their passages WHOLE, because they do not speak
 * of one line: text addressed to the AI (nothing of that passage is the business's word) and a roll-up that stands for many points;
 * both are the points that offer no choice.
 */
export const wholeHeldHashes = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlySet<string> =>
    new Set(
        rows
            .filter((row) => isActive(row) && holdingPoint(row) && !namesAllOf(row) && offersNoChoice(row))
            .flatMap((row) => storedOwnHashes(row)),
    )

/** The hashes held back from customers: those quoted by an open HOLDING point (`holdingPoint`). */
export const heldHashes = (rows: ReadonlyArray<DossierFindingEntity>): ReadonlySet<string> =>
    new Set(rows.filter((row) => isActive(row) && holdingPoint(row)).flatMap((row) => storedOwnHashes(row)))

/** The longest quote a critic point stores. */
export const CRITIC_QUOTE_MAX: number = CRITIC_CAPS.quoteMax
