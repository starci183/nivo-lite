import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY, MAX_LINE } from "../../bounds"

/** Where a candidate stands: new, screened, interview, offer, hired or rejected. */
export const CANDIDATE_STAGES: readonly [string, ...Array<string>] = [
    "new",
    "screened",
    "interview",
    "offer",
    "hired",
    "rejected",
]

/** The stages of a candidate still in progress: neither hired nor rejected. */
export const OPEN_CANDIDATE_STAGES: ReadonlyArray<string> = ["new", "screened", "interview", "offer"]

/** The content types a CV file is accepted in: PDF, Word, plain text or a picture of the page. */
export const CV_ACCEPT: readonly [string, ...Array<string>] = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/*",
]

/** The largest CV file: 10 MB. */
export const CV_MAX_BYTES = 10_000_000

type CandidateFields = {
    readonly name: FieldDef<"text", false>
    readonly contactId: FieldDef<"contact", true>
    readonly contact: FieldDef<"text", false>
    readonly jobId: FieldDef<"uuid", false>
    readonly cv: FieldDef<"file", true>
    readonly profile: FieldDef<"text", false>
    readonly stage: FieldDef<"enum", false>
    readonly screeningSummary: FieldDef<"text", false>
    readonly notes: FieldDef<"text", false>
}

const candidateFields: CandidateFields = {
    name: field.text({ maxLength: MAX_LINE, searchable: true }),
    contactId: field.contact({ nullable: true }),
    contact: field.text({ maxLength: MAX_LINE, searchable: true, default: "empty" }),
    jobId: field.uuid(),
    cv: field.file({ accept: CV_ACCEPT, maxBytes: CV_MAX_BYTES }),
    profile: field.text({ maxLength: MAX_BODY, default: "empty" }),
    stage: field.enum({ of: CANDIDATE_STAGES, default: { literal: "new" } }),
    screeningSummary: field.text({ maxLength: MAX_BODY, default: "empty" }),
    notes: field.text({ maxLength: MAX_BODY, default: "empty" }),
}

/**
 * A person who applied for a job (`jobId`, a `blocks-core.hiring.job`): their name, `contactId` (the core contact when the engine met them; the
 * record goes with the contact when it is erased) and how the business reaches them (`contact`, text), their CV file, what a person of the
 * business wrote of it (`profile`: experience, skills, availability), the stage they are at, the screening's summary for the person who
 * decides, and the team's notes. Graph node kind `hiring-candidate`.
 */
export const hiringCandidateEntity: EntityDefinition<CandidateFields> = defineEntity({
    name: "blocks-core.hiring.candidate",
    dataKind: "hiring-candidate",
    fields: candidateFields,
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "stage_recent", on: ["stage", { desc: "createdAt" }, { desc: "id" }] },
        { name: "job_recent", on: ["jobId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "contact_recent", on: ["contactId", { desc: "createdAt" }, { desc: "id" }] },
    ],
    deletable: true,
})
