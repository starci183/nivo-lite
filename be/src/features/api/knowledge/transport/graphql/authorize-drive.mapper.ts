import type { AuthorizeDriveRequest, AuthorizeDriveResult } from "../../application/authorize-drive.contracts"
import type { AuthorizeDriveInput } from "./dto/authorize-drive.input"
import type { DriveAuthorizeUrlType } from "./dto/drive-authorize-url.type"

/** Maps the GraphQL arguments of authorizeDrive to the request. */
export const toAuthorizeDriveRequest = (workspaceId: string, input: AuthorizeDriveInput): AuthorizeDriveRequest => ({
    workspaceId,
    returnTo: input.returnTo,
})

/** Maps the answer of authorizeDrive to the GraphQL type. */
export const toDriveAuthorizeUrlType = (result: AuthorizeDriveResult): DriveAuthorizeUrlType => result
