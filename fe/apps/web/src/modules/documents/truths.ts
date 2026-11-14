import type { useTranslations } from "next-intl"
import type {
    DocTruthChipView,
    DocTruthControlView,
    DocTruthRowView,
    DocumentStatus,
    DocumentTruthStage,
    DocumentTruths,
    DocumentTruthState,
    KnowledgeDocument,
} from "@/modules/types"

type TruthsTranslate = ReturnType<typeof useTranslations<"brainTruths">>

/** The code a document carries while one part of its file waits for the others before anything of it goes in force. */
export const NOTE_AWAITING_PARTS = "BRAIN_NOTE_AWAITING_PARTS"

/** What `knowledgeSources { truths }` answers for one document. */
interface TruthsRow {
    readonly state: string
    readonly stage: string | null
    readonly note: string | null
    readonly passagesTotal: number
    readonly passagesTriaged: number
    readonly passagesKept: number
    readonly callsDone: number
    readonly callsTotal: number
    readonly truthsFound: number
    readonly truthsInForce: number
    readonly truthsAsked: number
    readonly truthsWaiting: number
    readonly callsSkipped?: number | null
    readonly linesRefused?: number | null
}

const STATES: ReadonlyArray<DocumentTruthState> = [
    "running",
    "awaiting_critique",
    "blocked_credits",
    "at_ceiling",
    "failed",
    "legacy",
    "done",
]
const STAGES: ReadonlyArray<DocumentTruthStage> = ["triage", "extract", "settle"]

/** The truths of a document as the app knows them; null when the document is not indexed yet or the state is one this build does not know. */
export const toDocumentTruths = (row: TruthsRow | null | undefined): DocumentTruths | null => {
    if (row === null || row === undefined) return null
    const state = STATES.find((one) => one === row.state)
    if (state === undefined) return null
    return {
        state,
        stage: STAGES.find((one) => one === row.stage) ?? null,
        note: row.note,
        passagesTotal: row.passagesTotal,
        passagesTriaged: row.passagesTriaged,
        passagesKept: row.passagesKept,
        callsDone: row.callsDone,
        callsTotal: row.callsTotal,
        truthsFound: row.truthsFound,
        truthsInForce: row.truthsInForce,
        truthsAsked: row.truthsAsked,
        truthsWaiting: row.truthsWaiting,
        callsSkipped: row.callsSkipped ?? 0,
        linesRefused: row.linesRefused ?? 0,
    }
}

/** Statuses whose passages are stored: the document can be found (an older build still says `extracting_facts` here). */
const SEARCHABLE: ReadonlySet<DocumentStatus> = new Set(["ready", "extracting_facts", "blocked_credits"])

/** The notes of a finished reading that the row says in words. */
const NOTE_WINDOWS_SKIPPED = "BRAIN_NOTE_WINDOWS_SKIPPED"
const NOTE_LINES_REFUSED = "BRAIN_NOTE_LINES_REFUSED"
const NOTE_AWAITING_FOUNDER = "BRAIN_NOTE_AWAITING_FOUNDER"

/** What a row is made from. */
export interface DocTruthInput {
    readonly source: KnowledgeDocument
    readonly truths: DocumentTruths | null
    readonly canWrite: boolean
    /** Whether the document itself may be run again (it failed and the failure is not final). */
    readonly canRetryDocument: boolean
    readonly isRetrying: boolean
}

/** How many chips a row shows. */
const MAX_CHIPS = 2

const chip = (label: string, tone: DocTruthChipView["tone"], isDot = false): DocTruthChipView => ({
    label,
    tone,
    isDot,
})

/** The part of the meta line that says whether the document is found and how much of it is stored. */
const foundWordOf = (t: TruthsTranslate, source: KnowledgeDocument): string => {
    if (source.status === "failed") return t("metaFailed")
    if (source.status === "blocked_credits") return t("metaKeywordOnly", { count: source.chunkCount })
    return SEARCHABLE.has(source.status) ? t("metaSearchable", { count: source.chunkCount }) : t("metaIngesting")
}

/** The meta words of a truths work that is no longer running: the old way of reading, or the note a finished reading carries. */
const finishedWordOf = (t: TruthsTranslate, truths: DocumentTruths): string => {
    if (truths.state === "legacy") return t("metaLegacy")
    if (truths.note === NOTE_WINDOWS_SKIPPED) return t("metaWindowsSkipped", { count: truths.callsSkipped })
    if (truths.note === NOTE_LINES_REFUSED) return t("metaLinesRefused", { count: truths.linesRefused })
    if (truths.note === NOTE_AWAITING_FOUNDER) return t("metaAwaitingFounder", { count: truths.truthsWaiting })
    return truths.passagesKept === 0 ? t("metaDataOnly") : t("metaKept", { count: truths.passagesKept })
}

/** The part of the meta line that says where the truths work stands. */
const truthsWordOf = (t: TruthsTranslate, truths: DocumentTruths): string => {
    if (truths.state === "running") {
        if (truths.stage === "triage")
            return t("metaTriage", { done: truths.passagesTriaged, total: truths.passagesTotal })
        if (truths.stage === "extract")
            return t("metaExtract", { done: truths.callsDone, total: truths.callsTotal, found: truths.truthsFound })
        return t("metaSettle")
    }
    if (truths.state === "awaiting_critique")
        return truths.note === NOTE_AWAITING_PARTS
            ? t("metaAwaitingParts")
            : t("metaAwaitingCritique", { count: truths.truthsFound })
    if (truths.state === "blocked_credits") return t("metaTruthsCredits")
    if (truths.state === "at_ceiling") return t("metaCeiling", { count: truths.truthsWaiting })
    if (truths.state === "failed") return t("metaTruthsFailed")
    return finishedWordOf(t, truths)
}

/** The chips of a finished truths work: what is in force, what needs the founder, what waits for him. */
const doneChipsOf = (t: TruthsTranslate, truths: DocumentTruths): ReadonlyArray<DocTruthChipView> => {
    if (truths.passagesKept === 0) return [chip(t("chipDataOnly"), "neutral")]
    const found = [
        ...(truths.truthsInForce > 0 ? [chip(t("chipInForce", { count: truths.truthsInForce }), "success")] : []),
        ...(truths.truthsAsked > 0 ? [chip(t("chipAsked", { count: truths.truthsAsked }), "warning")] : []),
        ...(truths.truthsWaiting > 0 ? [chip(t("chipWaiting", { count: truths.truthsWaiting }), "neutral")] : []),
    ]
    return found.length > 0 ? found : [chip(t("chipInForce", { count: 0 }), "neutral")]
}

/** The chips of a document read the old way: that, and what it put in force. */
const legacyChipsOf = (t: TruthsTranslate, truths: DocumentTruths): ReadonlyArray<DocTruthChipView> => [
    chip(t("chipLegacy"), "neutral"),
    ...(truths.truthsInForce > 0 ? [chip(t("chipInForce", { count: truths.truthsInForce }), "success")] : []),
]

/** The chips of a truths work by its state. */
const truthChipsOf = (t: TruthsTranslate, truths: DocumentTruths): ReadonlyArray<DocTruthChipView> => {
    if (truths.state === "running") {
        if (truths.stage === "triage") return [chip(t("chipTriage"), "neutral", true)]
        if (truths.stage === "extract") return [chip(t("chipExtract"), "neutral", true)]
        return [chip(t("chipSettle"), "neutral", true)]
    }
    if (truths.state === "awaiting_critique")
        return [
            truths.note === NOTE_AWAITING_PARTS
                ? chip(t("chipExtract"), "neutral", true)
                : chip(t("chipCritique"), "neutral"),
        ]
    if (truths.state === "blocked_credits") return [chip(t("chipNoCredit"), "warning")]
    if (truths.state === "at_ceiling")
        return [
            chip(t("chipCeiling"), "warning"),
            ...(truths.truthsWaiting > 0 ? [chip(t("chipWaiting", { count: truths.truthsWaiting }), "neutral")] : []),
        ]
    if (truths.state === "failed") return [chip(t("chipReadFailed"), "danger")]
    return truths.state === "legacy" ? legacyChipsOf(t, truths) : doneChipsOf(t, truths)
}

/** The chips of a document that is not yet indexed or failed: the document's own state comes first. */
const documentChipsOf = (t: TruthsTranslate, source: KnowledgeDocument): ReadonlyArray<DocTruthChipView> => {
    if (source.status === "failed") return [chip(t("chipDocFailed"), "danger")]
    if (source.status === "blocked_credits") return [chip(t("chipNoCredit"), "warning")]
    if (SEARCHABLE.has(source.status)) return []
    return [chip(t("chipIngesting"), "neutral", true)]
}

/** The one neutral command of a row, if it has one: try again, top up credits, or answer the questions. */
const controlOf = (t: TruthsTranslate, input: DocTruthInput): DocTruthControlView | null => {
    const { source, truths } = input
    if (!input.canWrite) return null
    if (source.status === "failed" && input.canRetryDocument)
        return { kind: "retry", label: t("actionRetry"), isPending: input.isRetrying }
    if (truths?.state === "failed") return { kind: "retry", label: t("actionRetry"), isPending: input.isRetrying }
    if (truths?.state === "legacy" || truths?.note === NOTE_WINDOWS_SKIPPED)
        return { kind: "retry", label: t("actionReread"), isPending: input.isRetrying }
    if (source.status === "blocked_credits" || truths?.state === "blocked_credits")
        return { kind: "topup", label: t("actionTopUp"), isPending: false }
    if (truths !== null && truths.truthsAsked > 0) return { kind: "answer", label: t("actionAnswer"), isPending: false }
    return null
}

/** Keeps the first chip of each label: the document's state and the truths' state may both say "out of credits". */
const distinctChips = (chips: ReadonlyArray<DocTruthChipView>): ReadonlyArray<DocTruthChipView> =>
    chips.filter((one, index) => chips.findIndex((other) => other.label === one.label) === index)

/**
 * The row of a document in the list of the Second Brain: the meta line says whether it is found and where its truths work is, the chips
 * say the result (no dot) or the live step (dot). A document the server has not told the truths of (not indexed yet, or an older one)
 * shows nothing new.
 */
export const docTruthRowOf = (t: TruthsTranslate, input: DocTruthInput): DocTruthRowView => {
    const { source, truths } = input
    const reachable = SEARCHABLE.has(source.status)
    const truthsKnown = truths !== null && reachable ? truths : null
    const older = truths === null && source.status === "extracting_facts"
    const parts = [
        foundWordOf(t, source),
        ...(truthsKnown === null ? [] : [truthsWordOf(t, truthsKnown)]),
        ...(older ? [t("metaReadingFacts")] : []),
    ]
    const chips = distinctChips([
        ...documentChipsOf(t, source),
        ...(truthsKnown === null ? [] : truthChipsOf(t, truthsKnown)),
        ...(older ? [chip(t("chipExtract"), "neutral", true)] : []),
    ])
    return {
        id: source.id,
        title: source.title,
        // A row shows at most two chips (Grammar's rule); what does not fit is said in the meta line.
        meta: [...parts, ...chips.slice(MAX_CHIPS).map((one) => one.label)].join(" · "),
        chips: chips.slice(0, MAX_CHIPS),
        control: controlOf(t, input),
    }
}
