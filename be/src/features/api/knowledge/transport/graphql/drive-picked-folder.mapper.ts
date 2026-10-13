import type { DrivePickedFolderRequest } from "../../application/drive-picked-folder.contracts"
import type { PickedFolder } from "@modules/domain/knowledge"
import type { DrivePickedFolderInput } from "./dto/drive-picked-folder.input"
import type { PickedFolderType } from "./dto/picked-folder.type"
import { toDriveFolderType } from "./knowledge-records.mapper"

/** Maps the GraphQL input to the request. */
export const toDrivePickedFolderRequest = (workspaceId: string, input: DrivePickedFolderInput): DrivePickedFolderRequest => ({
    workspaceId,
    folderId: input.folderId,
    token: input.token,
})

/** Maps the answer to the GraphQL type. */
export const toDrivePickedFolderType = (result: PickedFolder): PickedFolderType => ({ ...toDriveFolderType(result), empty: result.empty })
