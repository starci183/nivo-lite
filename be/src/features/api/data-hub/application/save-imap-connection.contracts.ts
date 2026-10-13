import type { ImapInput } from "@modules/domain/data-hub"

/** What saveImapConnection takes. */
export interface SaveImapConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The mailbox settings to save. */
    readonly input: ImapInput
}
