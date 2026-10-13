import type { GoogleAuthorizeRequest, GoogleAuthorizeResult } from "../../application/google-authorize.contracts"
import type { GoogleAuthorizeBody } from "./dto/google-authorize.request"
import type { GoogleAuthorizeResponse } from "./dto/google-authorize.response"
import type { GoogleAccountsRequest, GoogleAccountsResult } from "../../application/google-accounts.contracts"
import type { GoogleAccountsResponse } from "./dto/google-accounts.response"
import type { GoogleStateRequest, GoogleStateResult } from "../../application/google-state.contracts"
import type { GoogleStateResponse } from "./dto/google-state.response"

/** Maps the HTTP path and body to the GoogleAuthorize request. */
export const toGoogleAuthorizeRequest = (workspaceId: string, body: GoogleAuthorizeBody): GoogleAuthorizeRequest => ({
    workspaceId,
    returnTo: body.returnTo,
})

/** Maps the GoogleAuthorize result to the HTTP response. */
export const toGoogleAuthorizeResponse = (result: GoogleAuthorizeResult): GoogleAuthorizeResponse => ({
    url: result.url,
})

/** Maps the HTTP path and body to the GoogleAccounts request. */
export const toGoogleAccountsRequest = (workspaceId: string): GoogleAccountsRequest => ({ workspaceId })

/** Maps the GoogleAccounts result to the HTTP response. */
export const toGoogleAccountsResponse = (result: GoogleAccountsResult): GoogleAccountsResponse => ({
    accounts: result.map((account) => ({ id: account.id, email: account.email, status: account.status })),
})

/** Maps the HTTP path and body to the GoogleState request. */
export const toGoogleStateRequest = (workspaceId: string): GoogleStateRequest => ({ workspaceId })

/** Maps the GoogleState result to the HTTP response. */
export const toGoogleStateResponse = (result: GoogleStateResult): GoogleStateResponse => ({
    configured: result.configured,
})
