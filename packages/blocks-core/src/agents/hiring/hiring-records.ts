import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"

/** A row of the jobs list. */
export interface JobRow {
    /** The record id. */
    readonly id: string
    /** The title of the job. */
    readonly title: string
    /** `open` or `closed`. */
    readonly status: string
    /** When the job was created, ISO text. */
    readonly createdAt: string
}

/** A row of the candidates list. */
export interface CandidateRow {
    /** The record id. */
    readonly id: string
    /** The candidate's name. */
    readonly name: string
    /** How the business reaches the candidate. */
    readonly contact: string
    /** The `blocks-core.hiring.job` the candidate applied for. */
    readonly jobId: string
    /** The stage the candidate is at. */
    readonly stage: string
    /** When the candidate was added, ISO text. */
    readonly createdAt: string
}

/** A job as the workbench draws it in full. */
export interface JobView extends JobRow {
    /** What the work is. */
    readonly description: string
    /** The written requirements a candidate is screened against. */
    readonly requirements: string
}

/** A candidate as the workbench draws it in full, with the title of their job and the name of their CV file. */
export interface CandidateView extends CandidateRow {
    /** The title of the candidate's job, empty when the job is gone. */
    readonly jobTitle: string
    /** What a person of the business wrote of the CV. */
    readonly profile: string
    /** The screening's summary, empty before a screening. */
    readonly screeningSummary: string
    /** The team's notes. */
    readonly notes: string
    /** The name of the stored CV file, empty when none. */
    readonly cvName: string
}

/** The text member of a record's data, or empty. */
const textOf = (data: Readonly<Record<string, unknown>>, key: string): string => {
    const value = data[key]
    return typeof value === "string" ? value : ""
}

/** The name of the file a file field holds, or empty. */
const fileNameOf = (value: unknown): string => {
    if (typeof value !== "object" || value === null) return ""
    const name: unknown = Reflect.get(value, "name")
    return typeof name === "string" ? name : ""
}

/** A job record as the workbench draws it. */
export const jobViewOf = (row: RecordRow): JobView => ({
    id: row.id,
    title: textOf(row.data, "title"),
    description: textOf(row.data, "description"),
    requirements: textOf(row.data, "requirements"),
    status: textOf(row.data, "status"),
    createdAt: row.createdAt,
})

/** A candidate record as the workbench draws it, with the title of its job. */
export const candidateViewOf = (row: RecordRow, jobTitle: string): CandidateView => ({
    id: row.id,
    name: textOf(row.data, "name"),
    contact: textOf(row.data, "contact"),
    jobId: textOf(row.data, "jobId"),
    jobTitle,
    stage: textOf(row.data, "stage"),
    profile: textOf(row.data, "profile"),
    screeningSummary: textOf(row.data, "screeningSummary"),
    notes: textOf(row.data, "notes"),
    cvName: fileNameOf(row.data["cv"]),
    createdAt: row.createdAt,
})
