import type { CredentialPrincipal } from "@modules/domain/identity"
import { HiringError, HiringErrorCode } from "../errors/hiring.error"
import type { OfferRecord } from "../hiring.contracts"

/** The stored identifiers needed for opaque link admission. */
type StoredHiringLink = Pick<OfferRecord, "id" | "workspaceId"> | undefined

/** Only the stored record determines a link identity. */
export const hiringLinkPrincipal = (record: StoredHiringLink): CredentialPrincipal => {
    if (record === undefined) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
    return { kind: "link-token", subject: record.id, workspaceId: record.workspaceId }
}

/** Refuses credentials borrowed from another record or workspace. */
export const requireHiringLinkBinding = (principal: CredentialPrincipal, bound: CredentialPrincipal): void => {
    if (
        principal.kind !== bound.kind ||
        principal.subject !== bound.subject ||
        principal.workspaceId !== bound.workspaceId
    )
        throw new HiringError({ code: HiringErrorCode.PublicNotFound })
}
