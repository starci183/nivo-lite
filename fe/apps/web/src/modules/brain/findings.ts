/** How serious a finding is, worst first. Only critical, high and medium findings demote a dossier. */
export const FINDING_SEVERITIES = ["critical", "high", "medium", "low"] as const

/** One of the severities a finding can have. */
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

/** What is wrong with the dossier, in the order the kinds are worded. */
export const FINDING_KINDS = ["contradiction", "missing", "expired", "unsigned", "outdated", "unreasonable"] as const

/** One of the kinds a finding can have. */
export type FindingKind = (typeof FINDING_KINDS)[number]

/** Where a finding stands in its life. */
export const FINDING_STATUSES = ["open", "confirmed", "dismissed", "resolved"] as const

/** One of the statuses a finding can have. */
export type FindingStatus = (typeof FINDING_STATUSES)[number]

/** How a resolved finding went away. */
export const FINDING_RESOLUTIONS = ["document", "draft", "not_detected", "manual"] as const

/** One of the ways a finding is resolved. */
export type FindingResolution = (typeof FINDING_RESOLUTIONS)[number]

/** What completes a finding: a document to collect, a draft NIVO can write, a decision, or somebody outside. */
export const REMEDY_ACTIONS = ["upload", "draft", "decide", "external"] as const

/** One of the ways a finding is completed. */
export type RemedyAction = (typeof REMEDY_ACTIONS)[number]

/** The states of a remedy draft. */
export const REMEDY_DRAFT_STATUSES = ["generating", "proposed", "approved", "rejected", "failed"] as const

/** One of the states a remedy draft can have. */
export type RemedyDraftStatus = (typeof REMEDY_DRAFT_STATUSES)[number]

/** The tone of a badge. */
export type RowTone = "danger" | "warning" | "accent" | "muted" | "success" | "neutral"

/** The tone each severity wears: the penalty-bearing is danger, the governance gap a warning, the rest quieter. */
export const SEVERITY_TONE: Readonly<Record<FindingSeverity, RowTone>> = {
    critical: "danger",
    high: "warning",
    medium: "accent",
    low: "muted",
}

/** The tone each status wears: waiting is a warning, confirmed the accent, dismissed quiet, resolved success. */
export const FINDING_STATUS_TONE: Readonly<Record<FindingStatus, RowTone>> = {
    open: "warning",
    confirmed: "accent",
    dismissed: "muted",
    resolved: "success",
}

/** The three lists of the findings pane, in the order they are drawn. */
export const FINDING_FILTERS = ["open", "confirmed", "closed"] as const

/** One of the lists of the findings pane. */
export type FindingFilter = (typeof FINDING_FILTERS)[number]

/** The filters of the to do list, in the order they are drawn. */
export const TODO_FILTERS = ["all", "mine", "unassigned", "drafts"] as const

/** One of the filters of the to do list. */
export type TodoFilter = (typeof TODO_FILTERS)[number]

/** The severity choices of the to do list: every severity, or any. */
export const TODO_SEVERITY_FILTERS = ["all", ...FINDING_SEVERITIES] as const

/** One of the severity choices of the to do list. */
export type TodoSeverityFilter = (typeof TODO_SEVERITY_FILTERS)[number]

/** What narrows a read of findings, in the words of the domain; the read turns it into its request. */
export interface FindingsQuery {
    readonly dossierId?: string
    readonly statuses: ReadonlyArray<FindingStatus>
    readonly severities?: ReadonlyArray<FindingSeverity>
    /** `mine` is the viewer; `unassigned` nobody. */
    readonly assignee?: "mine" | "unassigned"
    readonly draftsAwaiting?: boolean
}

/** The list of the findings pane a finding sits in: dismissed and resolved findings are closed. */
export const filterOfStatus = (status: FindingStatus): FindingFilter =>
    status === "dismissed" || status === "resolved" ? "closed" : status

/** The read of the findings pane: every finding of the dossier, which the pane sorts into its three lists; of the whole set when no dossier is named. */
export const queryOfDossier = (dossierId?: string): FindingsQuery => ({
    ...(dossierId === undefined ? {} : { dossierId }),
    statuses: FINDING_STATUSES,
})

/** The read of the to do list: findings that still need somebody, narrowed by the filter and the severity. */
export const queryOfTodo = (filter: TodoFilter, severity: TodoSeverityFilter): FindingsQuery => {
    const base: FindingsQuery = {
        statuses: ["open", "confirmed"],
        ...(severity === "all" ? {} : { severities: [severity] }),
    }
    if (filter === "mine") return { ...base, assignee: "mine" }
    if (filter === "unassigned") return { ...base, assignee: "unassigned" }
    return filter === "drafts" ? { ...base, draftsAwaiting: true } : base
}
