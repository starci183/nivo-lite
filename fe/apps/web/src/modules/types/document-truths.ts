/** Where the truths work of one document stands (INGEST-2): a document is searchable first, its truths are read after. */
export type DocumentTruthState =
    "running" | "awaiting_critique" | "blocked_credits" | "at_ceiling" | "failed" | "legacy" | "done"

/** The step of the truths work a running document is at. */
export type DocumentTruthStage = "triage" | "extract" | "settle"

/** What the list of documents says about the truths of one document; null on the document until it is indexed. */
export interface DocumentTruths {
    readonly state: DocumentTruthState
    readonly stage: DocumentTruthStage | null
    /** The stored code of why the work waits or stopped (`BRAIN_NOTE_AWAITING_PARTS`, ...); null when there is none. */
    readonly note: string | null
    readonly passagesTotal: number
    readonly passagesTriaged: number
    /** The passages that state a rule; 0 on a finished document = data only, no truths. */
    readonly passagesKept: number
    readonly callsDone: number
    readonly callsTotal: number
    readonly truthsFound: number
    readonly truthsInForce: number
    /** Truths that need the founder's answer. */
    readonly truthsAsked: number
    /** Truths that wait for the founder (a manager's or staff member's document). */
    readonly truthsWaiting: number
    /** Reading calls that could not be read; the read-again command reads their passages again. */
    readonly callsSkipped: number
    /** Lines the reading refused because they did not match the document. */
    readonly linesRefused: number
}

/** The two allowances the usage block draws, as `knowledgeUsage` answers them (bytes and counts; the plan's own storage is not here). */
export interface DocumentUsage {
    /** Every uploaded document against the Second Brain documents limit (the same for every workspace; never the plan's storage). */
    readonly documents: { readonly usedBytes: number; readonly limitBytes: number; readonly count: number }
    /** The truths in force against their ceiling (5.000 truths, 2 MB). */
    readonly truths: {
        readonly count: number
        readonly limitCount: number
        readonly usedBytes: number
        readonly limitBytes: number
    }
}

/** The tone of a result chip of a document row. */
export type DocTruthChipTone = "neutral" | "success" | "warning" | "danger" | "muted"

/** One chip of a document row: a result (no dot) or a live state (dot). */
export interface DocTruthChipView {
    readonly label: string
    readonly tone: DocTruthChipTone
    readonly isDot: boolean
}

/** The one neutral command of a row beyond "Xem": answer the document's questions, try again, or top up credits. */
export interface DocTruthControlView {
    readonly kind: "answer" | "retry" | "topup"
    readonly label: string
    readonly isPending: boolean
}

/** One row of the documents list: the name, the meta line, the chips, and where each command leads. */
export interface DocTruthRowView {
    readonly id: string
    readonly title: string
    readonly meta: string
    readonly chips: ReadonlyArray<DocTruthChipView>
    readonly control: DocTruthControlView | null
}

/** One meter card of the usage block: what it measures, its reading, the meter and the line under it. */
export interface LimitCardView {
    readonly id: "documents" | "truths"
    readonly label: string
    /** The used size of the limit, worded: "19,8 MB of 20 MB". */
    readonly valueLabel: string
    readonly value: number
    readonly max: number
    /** The muted 12 line under the meter. */
    readonly caption: string
}

/** How full the documents allowance is: room left, from 90 % used, or none. */
export type LimitLevel = "normal" | "nearly" | "full"

/** The usage block: the two meter cards, and the notice that stands above them when the documents allowance is used up. */
export interface UsageLimitsView {
    readonly cards: readonly [LimitCardView, LimitCardView]
    readonly level: LimitLevel
    readonly full: { readonly title: string; readonly body: string } | null
}

/** Why a file was not uploaded: the bytes of the file and what is left of the allowance (the server's `KNOWLEDGE_SOURCES_QUOTA_EXCEEDED` params, or what the browser already knew). */
export interface QuotaRefusal {
    readonly fileBytes: number
    readonly leftBytes: number
    readonly limitBytes: number
}

/** What the paging footer of the facts list draws and calls: the page shown (from 1), the pages reachable now, and the span of the total. */
export interface FactsPagingView {
    readonly page: number
    readonly pageCount: number
    readonly total: number
    readonly from: number
    readonly to: number
}
