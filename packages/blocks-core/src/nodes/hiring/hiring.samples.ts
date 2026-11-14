import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import samples from "./hiring.samples.json"

/** The Vietnamese sample words of the hiring examples, kept as data. */
export const HIRING_SAMPLE: Readonly<Record<keyof typeof samples, string>> = samples

/** The id of the job of the examples. */
export const SAMPLE_JOB_ID = "8f1c2b9e-0d6a-4c41-9a37-2b1f5e6d7a01"

/** The id of the candidate of the examples. */
export const SAMPLE_CANDIDATE_ID = "3a7d9c10-5e2b-4f88-b1c6-9d0e4f2a8b02"

/** A job record as the record tools answer it. */
export const SAMPLE_JOB: JsonObject = {
    id: SAMPLE_JOB_ID,
    version: "1",
    createdAt: "2026-11-10T02:00:00.000Z",
    updatedAt: "2026-11-10T02:00:00.000Z",
    values: {
        title: HIRING_SAMPLE.jobTitle,
        description: HIRING_SAMPLE.jobDescription,
        requirements: HIRING_SAMPLE.jobRequirements,
        status: "open",
    },
}

/** The values of the candidate of the examples. */
const CANDIDATE_VALUES: JsonObject = {
    name: HIRING_SAMPLE.candidateName,
    contact: "minhanh@example.com",
    jobId: SAMPLE_JOB_ID,
    cv: null,
    profile: HIRING_SAMPLE.candidateProfile,
    stage: "new",
    screeningSummary: "",
    notes: "",
}

/** A candidate record as the record tools answer it, reached at `contact`. */
const candidateRecord = (contact: string): JsonObject => ({
    id: SAMPLE_CANDIDATE_ID,
    version: "3",
    createdAt: "2026-11-12T03:00:00.000Z",
    updatedAt: "2026-11-12T03:00:00.000Z",
    values: { ...CANDIDATE_VALUES, contact },
})

/** A candidate record as the record tools answer it. */
export const SAMPLE_CANDIDATE: JsonObject = candidateRecord("minhanh@example.com")

/** The candidate of the examples with no e-mail address to reach them. */
export const SAMPLE_CANDIDATE_PHONE: JsonObject = candidateRecord("0901 234 567")

/** The screening summary of the examples. */
export const SAMPLE_SUMMARY: string = HIRING_SAMPLE.summary

/** The interview questions of the examples. */
export const SAMPLE_QUESTIONS: ReadonlyArray<string> = [HIRING_SAMPLE.question]
