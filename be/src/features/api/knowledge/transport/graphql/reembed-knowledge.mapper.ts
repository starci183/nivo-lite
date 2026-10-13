import type { ReembedKnowledgeRequest } from "../../application/reembed-knowledge.contracts"

/** Maps the workspace of the call to the request. */
export const toReembedKnowledgeRequest = (workspaceId: string): ReembedKnowledgeRequest => ({ workspaceId })
