import { isRecord } from "@modules/platform/primitives"
import type { ProposalFieldValue } from "@modules/domain/work-items"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { LeadRequestBody } from "./public-api.contracts"
import { parsePublicLeadBody } from "./public-api-job.policy"
import type { PublicLeadMetadata } from "./public-lead-metadata.contracts"

/** The reserved durable handoff field, read from the original item rather than the person's editable draft. */
export const PUBLIC_API_LEAD_METADATA = "public_api_lead"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const invalid = (): never => {
    throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid, params: { field: PUBLIC_API_LEAD_METADATA } })
}

const identityOf = (value: unknown): string => (typeof value === "string" && UUID.test(value) ? value : invalid())

/** Serializes only an already-admitted request; the later performer validates it again against the durable input. */
export const publicLeadMetadata = (
    completionId: string,
    ledgerRequestId: string | null,
    body: LeadRequestBody,
): string => JSON.stringify({ version: 1, completionId, ledgerRequestId, body })

/** Refuses malformed reserved metadata; an ordinary non-API handoff has no metadata and needs no settlement. */
export const parsePublicLeadMetadata = (raw: ProposalFieldValue | undefined): PublicLeadMetadata | null => {
    if (raw === undefined) return null
    if (typeof raw !== "string") return invalid()
    let value: unknown
    try {
        value = JSON.parse(raw)
    } catch (cause) {
        throw new PublicApiError({
            code: PublicApiErrorCode.RequestInvalid,
            params: { field: PUBLIC_API_LEAD_METADATA },
            cause,
        })
    }
    if (!isRecord(value) || value.version !== 1) return invalid()
    const completionId = identityOf(value.completionId)
    const ledgerRequestId = value.ledgerRequestId === null ? null : identityOf(value.ledgerRequestId)
    if (ledgerRequestId !== null && completionId !== ledgerRequestId) return invalid()
    return { completionId, ledgerRequestId, body: parsePublicLeadBody(value.body, null) }
}
