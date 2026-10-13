import type { ImapInput } from "@modules/domain/data-hub"

/** What testImapConnection takes. */
export interface TestImapConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The mailbox settings to try. */
    readonly input: ImapInput
}
