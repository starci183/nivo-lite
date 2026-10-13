import type { AuthorizeGoogleRequest } from "../../application/authorize-google.contracts"
import type { AuthorizeGoogleResult } from "../../application/authorize-google.contracts"
import type { AuthorizeGoogleInput } from "./dto/authorize-google.input"
import type { AuthorizeUrlType } from "./dto/authorize-url.type"

/** Maps the GraphQL arguments of authorizeGoogle to the request. */
export const toAuthorizeGoogleRequest = (workspaceId: string, input: AuthorizeGoogleInput): AuthorizeGoogleRequest => ({
    workspaceId,
    returnTo: input.returnTo,
})

/** Maps the answer of authorizeGoogle to the GraphQL type. */
export const toAuthorizeGoogleType = (result: AuthorizeGoogleResult): AuthorizeUrlType => result
