import type { AddKnowledgeRequest, AddKnowledgeResult } from "../../application/add-knowledge.contracts"
import type { AddKnowledgeRequest as AddKnowledgeHttpRequest } from "./dto/add-knowledge.request"
import type { AddKnowledgeResponse } from "./dto/add-knowledge.response"

/** Maps the HTTP request to the command request. */
export const toAddKnowledgeRequest = (
    authorization: string | undefined,
    input: AddKnowledgeHttpRequest,
): AddKnowledgeRequest => ({
    authorization,
    title: input.title,
    content: input.content,
    topic: input.topic,
    visibility: input.visibility,
    tags: input.tags,
})

/** Maps the command result to the HTTP response. */
export const toAddKnowledgeResponse = (result: AddKnowledgeResult): AddKnowledgeResponse => ({
    data: { id: result.id, status: result.status },
})
