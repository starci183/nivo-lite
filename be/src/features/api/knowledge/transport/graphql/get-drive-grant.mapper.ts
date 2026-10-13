import type { DriveGrantResult, GetDriveGrantRequest } from "../../application/get-drive-grant.contracts"
import type { DriveGrantType } from "./dto/drive-grant.type"

/** Maps the GraphQL arguments of driveGrant to the request. */
export const toGetDriveGrantRequest = (workspaceId: string): GetDriveGrantRequest => ({ workspaceId })

/** Maps the answer of driveGrant to the GraphQL type. */
export const toDriveGrantType = (result: DriveGrantResult): DriveGrantType => result
