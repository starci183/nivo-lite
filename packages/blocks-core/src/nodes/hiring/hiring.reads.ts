import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { valueOrCannot } from "../tool-answers"

/** The record type of a job. */
export const JOB_TYPE = "blocks-core.hiring.job"

/** The record type of a candidate. */
export const CANDIDATE_TYPE = "blocks-core.hiring.candidate"

/** A job as the hiring steps read it. */
export interface JobFacts {
    /** The record id. */
    readonly id: string
    /** The title of the job. */
    readonly title: string
    /** What the work is. */
    readonly description: string
    /** The written requirements a candidate is compared with. */
    readonly requirements: string
    /** `open` or `closed`. */
    readonly status: string
}

/** A candidate as the hiring steps read it. */
export interface CandidateFacts {
    /** The record id. */
    readonly id: string
    /** The version the record was read at, for an optimistic update. */
    readonly version: string
    /** The candidate's name. */
    readonly name: string
    /** How the business reaches the candidate (an e-mail address or a phone). */
    readonly contact: string
    /** The `blocks-core.hiring.job` the candidate applied for. */
    readonly jobId: string
    /** What a person of the business wrote of the CV. */
    readonly profile: string
    /** Whether a CV file is stored on the record. */
    readonly cvAttached: boolean
    /** The stage the candidate is at. */
    readonly stage: string
    /** The screening's summary, empty before a screening. */
    readonly screeningSummary: string
}

/** The object member of a value, or an empty object. */
const objectOf = (value: unknown): Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

/** The text member of a record's values, or empty. */
const textOf = (values: Readonly<Record<string, unknown>>, key: string): string => {
    const value = values[key]
    return typeof value === "string" ? value : ""
}

/** A record as the record tools answer it: its id, version and declared values. */
interface ToolRecord {
    /** The record id. */
    readonly id: string
    /** The version token, decimal text. */
    readonly version: string
    /** The declared fields. */
    readonly values: Readonly<Record<string, unknown>>
}

/** A record as the record tools answer it (`{ id, version, values }`). */
const recordOf = (value: unknown): ToolRecord => {
    const record = objectOf(value)
    return { id: textOf(record, "id"), version: textOf(record, "version"), values: objectOf(record["values"]) }
}

/** A job from a record of `blocks-core.hiring.job`. */
export const jobOf = (value: unknown): JobFacts => {
    const { id, values } = recordOf(value)
    return {
        id,
        title: textOf(values, "title"),
        description: textOf(values, "description"),
        requirements: textOf(values, "requirements"),
        status: textOf(values, "status"),
    }
}

/** A candidate from a record of `blocks-core.hiring.candidate`. */
export const candidateOf = (value: unknown): CandidateFacts => {
    const { id, version, values } = recordOf(value)
    return {
        id,
        version,
        name: textOf(values, "name"),
        contact: textOf(values, "contact"),
        jobId: textOf(values, "jobId"),
        profile: textOf(values, "profile"),
        cvAttached: typeof values["cv"] === "object" && values["cv"] !== null,
        stage: textOf(values, "stage"),
        screeningSummary: textOf(values, "screeningSummary"),
    }
}

/** The records of a list answer (`{ records, next }`). */
export const recordsOf = (value: JsonObject): ReadonlyArray<unknown> => {
    const records = value["records"]
    return Array.isArray(records) ? records : []
}

/** Reads one candidate; a candidate the store does not hold stops the step. */
export const readCandidate = async (context: NodeContext, id: string): Promise<CandidateFacts> => {
    const answer = await context.tools.call(TOOL.recordGet, { type: CANDIDATE_TYPE, id })
    return candidateOf(valueOrCannot(context, TOOL.recordGet, answer)["record"])
}

/** Reads the job of a candidate; a job the store does not hold stops the step. */
export const readJob = async (context: NodeContext, id: string): Promise<JobFacts> => {
    const answer = await context.tools.call(TOOL.recordGet, { type: JOB_TYPE, id })
    return jobOf(valueOrCannot(context, TOOL.recordGet, answer)["record"])
}
