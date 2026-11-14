import { defineRecordQuery, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { hiringCandidateEntity } from "../../../entities/hiring/candidate.entity"
import { HIRING_VIEW } from "../constants"

/** The most candidate records one read answers for a contact: the contact detail shows the first rows, the candidates page holds the rest. */
export const CONTACT_CANDIDATES_PAGE = 5

/** The fields of a candidate the contact detail draws; nothing of the record's bookkeeping. */
const CONTACT_CANDIDATE_FIELDS = ["name", "stage", "screeningSummary"] as const

/** The text member of a record's data, or empty. */
const textOf = (row: RecordRow, key: string): string => {
    const value = row.data[key]
    return typeof value === "string" ? value : ""
}

/** The candidate record as the contact detail draws it: the name it was added under, the stage it is at and the screening's summary. */
const contactCandidateOf = (row: RecordRow): unknown => ({
    id: row.id,
    name: textOf(row, "name"),
    stage: textOf(row, "stage"),
    screeningSummary: textOf(row, "screeningSummary"),
})

/**
 * The candidate records of ONE contact (the Hiring's own records, the newest first): the read behind the Hiring's block on the contact
 * detail. The contact id follows a merge, so a person merged from two contacts shows the applications of both.
 */
export const CONTACT_CANDIDATES: ReadDefinition = defineRecordQuery({
    id: "blocks-core.hiring.api.candidate.of-contact",
    dataKind: "hiring-candidate",
    shape: "list",
    fields: ["rows"],
    paths: { rows: "list" },
    permission: HIRING_VIEW,
    variables: z.object({ contactId: z.string().min(1).max(MAX_ID) }),
    type: hiringCandidateEntity,
    view: contactCandidateOf,
    list: ({ contactId }) => ({
        select: CONTACT_CANDIDATE_FIELDS,
        where: q.eq("contactId", contactId),
        order: [
            ["createdAt", "desc"],
            ["id", "desc"],
        ],
        page: { size: CONTACT_CANDIDATES_PAGE },
    }),
})
