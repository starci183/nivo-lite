import type { Passage, PickedFolder } from "@modules/domain/knowledge"
import type { SourceRef, UploadAddress } from "@modules/domain/knowledge-sources"
import type { DriveFolderListing } from "@modules/integrations/documents"
import type { AddSourceRequest as AddCommandRequest } from "../../application/add-source.contracts"
import type { AskKnowledgeRequest as AskQueryRequest } from "../../application/ask-knowledge.contracts"
import type { ReindexSourceRequest as ReindexCommandRequest } from "../../application/reindex-source.contracts"
import type { UpdateSourceRequest as UpdateCommandRequest } from "../../application/update-source.contracts"
import type { AddSourceRequest } from "./dto/add-source.request"
import type { AskKnowledgeRequest } from "./dto/ask-knowledge.request"
import type { FolderResponse, PickedFolderResponse } from "./dto/folder.response"
import type { PassageResponse } from "./dto/passage.response"
import type { ReindexSourceRequest } from "./dto/reindex-source.request"
import type { SourceRefResponse } from "./dto/source-ref.response"
import type { UpdateSourceRequest } from "./dto/update-source.request"
import type { UploadAddressResponse } from "./dto/upload-address.response"

/** Maps the HTTP request that adds a document, with the workspace it names, to the command request. */
export const toAddSourceRequest = (workspaceId: string, input: AddSourceRequest): AddCommandRequest => ({
    workspaceId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    url: input.url,
    storagePath: input.storagePath,
    topic: input.topic,
    tags: input.tags,
    module: input.module,
    installationId: input.installationId,
    visibility: input.visibility,
    origin: input.origin,
})

/** Maps the HTTP request that reads a document again to the command request. */
export const toReindexSourceRequest = (
    workspaceId: string,
    sourceId: string,
    input: ReindexSourceRequest,
): ReindexCommandRequest => ({ workspaceId, sourceId, content: input.content })

/** Maps the HTTP request that changes a document to the command request. */
export const toUpdateSourceRequest = (
    workspaceId: string,
    sourceId: string,
    input: UpdateSourceRequest,
): UpdateCommandRequest => ({
    workspaceId,
    sourceId,
    title: input.title,
    topic: input.topic,
    tags: input.tags,
    module: input.module,
    visibility: input.visibility,
})

/** Maps the HTTP request that asks a question to the query request. */
export const toAskKnowledgeRequest = (workspaceId: string, input: AskKnowledgeRequest): AskQueryRequest => ({
    workspaceId,
    question: input.question,
    module: input.module,
    audience: input.audience,
})

/** Maps the reference of a written document to the HTTP response. */
export const toSourceRefResponse = (result: SourceRef): SourceRefResponse => ({ id: result.id })

/** Maps the upload address to the HTTP response. */
export const toUploadAddressResponse = (result: UploadAddress): UploadAddressResponse => ({
    path: result.path,
    token: result.token,
    signedUrl: result.signedUrl,
})

/** Maps the retrieved passages to the HTTP response. */
export const toPassagesResponse = (result: ReadonlyArray<Passage>): Array<PassageResponse> =>
    result.map((passage) => ({ ...passage }))

/** Maps a Drive folder listing to the HTTP response. */
export const toFolderResponse = (result: DriveFolderListing): FolderResponse => ({
    name: result.name,
    files: result.files.map((file) => ({ ...file })),
    truncated: result.truncated,
})

/** Maps a picked folder listing to the HTTP response. */
export const toPickedFolderResponse = (result: PickedFolder): PickedFolderResponse => ({
    name: result.name,
    files: result.files.map((file) => ({ ...file })),
    truncated: result.truncated,
    empty: result.empty,
})
