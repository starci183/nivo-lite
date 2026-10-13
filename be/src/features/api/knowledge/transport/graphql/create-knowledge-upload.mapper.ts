import type { CreateKnowledgeUploadRequest } from "../../application/create-knowledge-upload.contracts"
import type { UploadAddress } from "@modules/domain/knowledge-sources"
import type { CreateKnowledgeUploadInput } from "./dto/create-knowledge-upload.input"
import type { UploadAddressType } from "./dto/upload-address.type"

/** Maps the GraphQL input to the request. */
export const toCreateKnowledgeUploadRequest = (
    workspaceId: string,
    input: CreateKnowledgeUploadInput,
): CreateKnowledgeUploadRequest => ({
    workspaceId,
    filename: input.filename,
})

/** Maps the answer to the GraphQL type. */
export const toCreateKnowledgeUploadType = (result: UploadAddress): UploadAddressType => ({ ...result })
