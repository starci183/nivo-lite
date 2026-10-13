import type { EnqueueKnowledgeSourceRequest } from "../../application/enqueue-knowledge-source.contracts"
import type { SourceRef } from "@modules/domain/knowledge-sources"
import type { EnqueueKnowledgeSourceInput } from "./dto/enqueue-knowledge-source.input"
import type { SourceRefType } from "./dto/source-ref.type"

/** Maps the GraphQL input to the request. */
export const toEnqueueKnowledgeSourceRequest = (workspaceId: string, input: EnqueueKnowledgeSourceInput): EnqueueKnowledgeSourceRequest => ({
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

/** Maps the answer to the GraphQL type. */
export const toEnqueueKnowledgeSourceType = (result: SourceRef): SourceRefType => ({ id: result.id })
