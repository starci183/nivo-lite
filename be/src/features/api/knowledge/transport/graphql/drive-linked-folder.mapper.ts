import type { DriveLinkedFolderRequest } from "../../application/drive-linked-folder.contracts"
import type { DriveFolderListing } from "@modules/integrations/documents"
import type { DriveLinkedFolderInput } from "./dto/drive-linked-folder.input"
import type { DriveFolderType } from "./dto/drive-folder.type"
import { toDriveFolderType } from "./knowledge-records.mapper"

/** Maps the GraphQL input to the request. */
export const toDriveLinkedFolderRequest = (
    workspaceId: string,
    input: DriveLinkedFolderInput,
): DriveLinkedFolderRequest => ({
    workspaceId,
    url: input.url,
})

/** Maps the answer to the GraphQL type. */
export const toDriveLinkedFolderType = (result: DriveFolderListing): DriveFolderType => toDriveFolderType(result)
