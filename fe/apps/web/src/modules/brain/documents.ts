import type { useTranslations } from "next-intl"
import { isDocumentActive } from "@/modules/documents"
import { trustLevelOf } from "./labels"
import type { TrustLevel } from "./labels"
import type {
    BrainDocFactView,
    BrainDocRowView,
    BrainDocStepState,
    BrainDocStepView,
    BrainExtraction,
    BrainFact,
    KnowledgeDocument,
} from "@/modules/types"

type DocsTranslate = ReturnType<typeof useTranslations<"brainDocuments">>

/** The facts a document gave: the ones that wait for the owner and the ones in force. */
interface DocumentFacts {
    readonly proposed: ReadonlyArray<BrainFact>
    readonly approved: ReadonlyArray<BrainFact>
}

/** Whether the evidence of a fact cites the document. */
const citesDocument = (fact: BrainFact, sourceId: string): boolean =>
    fact.evidence.some((proof) => proof.kind === "document" && proof.ref === sourceId)

/** The facts a document gave, split by where they stand: a proposal to stop using a value is not a fact the document gave. */
export const factsOfDocument = (facts: ReadonlyArray<BrainFact>, sourceId: string): DocumentFacts => {
    const own = facts.filter((fact) => fact.proposalKind === "set" && citesDocument(fact, sourceId))
    return {
        proposed: own.filter((fact) => fact.status === "proposed"),
        approved: own.filter((fact) => fact.status === "active"),
    }
}

/** What the drawer and the row of a document are made from. */
export interface DocumentInput {
    readonly source: KnowledgeDocument
    readonly facts: DocumentFacts
    /** How reading its facts went; undefined while it is not known. */
    readonly reading: BrainExtraction["status"] | undefined
}

/** The ids of the steps, in the order a document takes them. */
const STEP_IDS = ["intake", "read", "extract", "review", "use"] as const
type StepId = (typeof STEP_IDS)[number]

/** The step a document stands at, and how its marker reads there. */
interface Standing {
    readonly at: StepId
    readonly state: BrainDocStepState
}

/** Where a ready document stands: its facts are being read, were not read, or wait for the owner or are in use. */
const readyStandingOf = (input: DocumentInput): Standing => {
    if (input.reading === "failed") return { at: "extract", state: "error" }
    if (input.reading === "blocked_credits") return { at: "extract", state: "paused" }
    if (input.reading !== "done") return { at: "extract", state: "current" }
    if (input.facts.proposed.length > 0) return { at: "review", state: "current" }
    return input.facts.approved.length > 0 ? { at: "use", state: "complete" } : { at: "extract", state: "complete" }
}

/** Where a document stands on its way into the brain. */
const standingOf = (input: DocumentInput): Standing => {
    const status = input.source.status
    if (status === "failed") return { at: "read", state: "error" }
    if (status === "blocked_credits") return { at: "read", state: "paused" }
    if (status === "ready") return readyStandingOf(input)
    if (status === "extracting_facts") return { at: "extract", state: "current" }
    return isDocumentActive(status) && status !== "pending" && status !== "queued"
        ? { at: "read", state: "current" }
        : { at: "intake", state: "current" }
}

/** What each step says under its name, from the facts the document gave. */
const stepNotesOf = (t: DocsTranslate, input: DocumentInput, date: string): Readonly<Record<StepId, string>> => {
    const { proposed, approved } = input.facts
    const isRead = input.source.status === "ready" && input.reading === "done"
    return {
        intake: date,
        read: "",
        extract: isRead ? t("stepFacts", { count: proposed.length + approved.length }) : "",
        review: proposed.length > 0 ? t("stepWaiting") : "",
        use: approved.length > 0 ? t("stepInUse", { count: approved.length }) : "",
    }
}

/** The steps of a document's way in, each with its marker: done before the one it stands at, to do after it. */
export const stepsOf = (
    t: DocsTranslate,
    input: DocumentInput,
    date: string,
): { readonly steps: ReadonlyArray<BrainDocStepView>; readonly currentStepId: string } => {
    const standing = standingOf(input)
    const at = STEP_IDS.indexOf(standing.at)
    const notes = stepNotesOf(t, input, date)
    const stateOf = (index: number): BrainDocStepState => {
        if (index === at) return standing.state
        return index < at ? "complete" : "upcoming"
    }
    return {
        steps: STEP_IDS.map((id, index) => ({
            id,
            label: t(`step_${id}`),
            description: notes[id],
            state: stateOf(index),
        })),
        currentStepId: standing.at,
    }
}

/** The catalog key of each document kind. */
const KIND_KEY = { text: "kindText", faq: "kindFaq", file: "kindFile", url: "kindUrl" } as const

/** The kind of a document, as a word. */
export const docKindWordOf = (t: DocsTranslate, source: KnowledgeDocument): string => t(KIND_KEY[source.kind])

/** The one word where a document stands and its tone: reading, failed, waiting for the owner, in use or without facts. */
const statusOf = (t: DocsTranslate, input: DocumentInput): Pick<BrainDocRowView, "status" | "statusTone"> => {
    const status = input.source.status
    if (status === "failed") return { status: t("statusFailed"), statusTone: "danger" }
    if (status === "blocked_credits") return { status: t("statusBlocked"), statusTone: "warning" }
    if (status === "pending" || status === "queued") return { status: t("statusPending"), statusTone: "neutral" }
    if (status !== "ready" || input.reading !== "done") return { status: t("statusReading"), statusTone: "neutral" }
    if (input.facts.proposed.length > 0) return { status: t("statusWaiting"), statusTone: "warning" }
    return input.facts.approved.length > 0
        ? { status: t("statusInUse"), statusTone: "success" }
        : { status: t("statusEmpty"), statusTone: "neutral" }
}

/** One row of the documents table. */
export const docRowViewOf = (t: DocsTranslate, input: DocumentInput, updated: string): BrainDocRowView => ({
    id: input.source.id,
    title: input.source.title,
    kind: docKindWordOf(t, input.source),
    proposed: input.facts.proposed.length > 0 ? t("factsProposed", { count: input.facts.proposed.length }) : null,
    approved: input.facts.approved.length > 0 ? t("factsApproved", { count: input.facts.approved.length }) : null,
    updated,
    ...statusOf(t, input),
})

/** The tone of each trust level's badge. */
const TRUST_TONE: Readonly<Record<TrustLevel, BrainDocFactView["trustTone"]>> = {
    high: "success",
    medium: "neutral",
    low: "warning",
}

/** The most characters of a quote that fit a row. */
const QUOTE_CHARS = 90

/** The words of the document that say a fact, cut to a line; null when it has none. */
const quoteOf = (fact: BrainFact, sourceId: string): string | null => {
    const quote = fact.evidence.find((proof) => proof.kind === "document" && proof.ref === sourceId)?.quote?.trim()
    if (quote === undefined || quote === "") return null
    return quote.length > QUOTE_CHARS ? `${quote.slice(0, QUOTE_CHARS)}…` : quote
}

/** The words a drawer needs to list facts. */
export interface FactWords {
    readonly t: DocsTranslate
    readonly trustLabel: (level: TrustLevel) => string
}

/** The facts of a document as rows: the ones that wait first, each with its value, its trust and the words of the document. */
export const factViewsOf = (
    words: FactWords,
    sourceId: string,
    facts: DocumentFacts,
): ReadonlyArray<BrainDocFactView> =>
    [...facts.proposed, ...facts.approved].map((fact) => {
        const level = trustLevelOf(fact.trust)
        const isWaiting = fact.status === "proposed"
        return {
            id: fact.id,
            title: `${fact.subjectLabel} · ${fact.attributeLabel}`,
            value: fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`,
            quote: quoteOf(fact, sourceId),
            state: isWaiting ? words.t("factWaiting") : words.t("factApproved"),
            stateTone: isWaiting ? "warning" : "success",
            trust: words.trustLabel(level),
            trustTone: TRUST_TONE[level],
        }
    })

/** The rows a table of documents draws while its read loads: the same shape as real ones, in the words of the tab. */
export const docRowsPlaceholderOf = (t: DocsTranslate): ReadonlyArray<BrainDocRowView> =>
    ["a", "b", "c"].map((id) => ({
        id,
        title: t("tableLabel"),
        kind: t("kindText"),
        proposed: t("factsProposed", { count: 0 }),
        approved: null,
        status: t("statusPending"),
        statusTone: "neutral",
        updated: t("colUpdated"),
    }))
