import type { GoogleAccount } from "@modules/domain/google-connections"

/** What the GoogleAccounts operation takes. */
export interface GoogleAccountsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What the GoogleAccounts operation answers. */
export type GoogleAccountsResult = ReadonlyArray<GoogleAccount>
