import type { ListGoogleAccountsRequest } from "../../application/list-google-accounts.contracts"
import type { GoogleAccount } from "@modules/domain/google-connections"
import type { GoogleAccountType } from "./dto/google-account.type"

/** Maps the GraphQL arguments of googleAccounts to the request. */
export const toListGoogleAccountsRequest = (workspaceId: string): ListGoogleAccountsRequest => ({
    workspaceId,
})

/** Maps the answer of googleAccounts to the GraphQL type. */
export const toListGoogleAccountsType = (result: ReadonlyArray<GoogleAccount>): Array<GoogleAccountType> => [...result]
