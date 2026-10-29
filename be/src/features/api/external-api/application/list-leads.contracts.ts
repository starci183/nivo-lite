import type { LeadListItem, PublicLeadStage } from "@modules/domain/public-api"

/** What listing customers takes: the bearer header, an optional stage and the page size as the caller wrote it. */
export interface ListLeadsRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** Only customers of this stage. */
    readonly stage?: PublicLeadStage | undefined
    /** The most customers to answer; the domain clamps it to 1..200. */
    readonly limit?: string | undefined
}

/** What listing customers answers: the customers, newest first. */
export type ListLeadsResult = ReadonlyArray<LeadListItem>
