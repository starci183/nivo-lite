import type { GoogleAccount } from "@modules/domain/automations"

/** What list google accounts takes. */
export interface ListGoogleAccountsRequest {
    /** The workspace. */
    readonly workspaceId: string
}

/** What list google accounts answers. */
export type ListGoogleAccountsResult = ReadonlyArray<GoogleAccount>
