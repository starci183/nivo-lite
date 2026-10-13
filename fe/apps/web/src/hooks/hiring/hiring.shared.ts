import type { BadgeTone } from "@starci/grammar/common"

/** The names of the fields of a form whose value is of one kind (every string field, every number field...). */
export type FieldOf<Values, Kind> = {
    [Name in keyof Values]: Values[Name] extends Kind ? Name : never
}[keyof Values]

/** The lanes of the pipeline board: rejected closes it (withdrawn candidates sit outside the board). */
export const PIPELINE_STAGES: ReadonlyArray<string> = [
    "applied",
    "screening",
    "shortlisted",
    "interview",
    "offer",
    "hired",
    "rejected",
]

/** The stage a manager can move a candidate to by hand: hired and offer follow from an answered offer. */
export const MOVE_STAGES: ReadonlyArray<string> = PIPELINE_STAGES.filter(
    (stage) => stage !== "hired" && stage !== "offer",
)

/** The tabs of the Hiring workbench, in display order. */
export const HIRING_TAB_IDS: ReadonlyArray<string> = [
    "jobs",
    "candidates",
    "interviews",
    "offers",
    "onboarding",
    "settings",
]

/** The statuses a job moves to from each status. */
export const NEXT_JOB_STATUS: Readonly<Record<string, ReadonlyArray<string>>> = {
    draft: ["open"],
    open: ["paused", "closed"],
    paused: ["open", "closed"],
    closed: ["open"],
}

/** The offer statuses in which an offer is still alive and can be cancelled. */
export const OPEN_OFFER_STATUSES: ReadonlyArray<string> = ["draft", "waiting", "sent"]

/** The interview statuses in which an interview is still open. */
export const OPEN_INTERVIEW_STATUSES: ReadonlyArray<string> = ["proposed", "confirmed"]

/** The stages in which a candidate's file is closed. */
export const CLOSED_STAGES: ReadonlyArray<string> = ["rejected", "withdrawn", "hired"]

/** The badge tone of a candidate stage. */
export const stageTone = (stage: string): BadgeTone => {
    if (stage === "hired") return "success"
    if (stage === "rejected" || stage === "withdrawn") return "danger"
    if (stage === "applied" || stage === "shortlisted") return "accent"
    if (stage === "interview" || stage === "offer") return "warning"
    return "neutral"
}

/** The badge tone of a screening label. */
export const scoreTone = (label: string | null): BadgeTone => {
    if (label === "fit") return "success"
    return label === "consider" ? "warning" : "neutral"
}

/** The badge tone of one screening line. */
export const reasonTone = (status: string): BadgeTone => {
    if (status === "met") return "success"
    return status === "unmet" ? "danger" : "neutral"
}

/** The badge tone of a job status. */
export const jobStatusTone = (status: string): BadgeTone => {
    if (status === "open") return "success"
    if (status === "draft") return "neutral"
    return status === "paused" ? "warning" : "danger"
}

/** The badge tone of an offer status. */
export const offerStatusTone = (status: string): BadgeTone => {
    if (status === "accepted") return "success"
    if (status === "declined" || status === "expired" || status === "cancelled") return "danger"
    return status === "waiting" ? "warning" : "accent"
}

/** Splits a text area into its non-empty trimmed lines. */
export const linesOf = (text: string): Array<string> =>
    text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")

/** Resolves a word of the `hiring` catalog; the connected block hands it to its drawing half. */
export type HiringSay = (key: string, values?: Record<string, string | number>) => string
