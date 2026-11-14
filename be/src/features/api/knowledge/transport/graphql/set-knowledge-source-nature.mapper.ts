import type { NatureAnswered } from "@modules/domain/brain"
import type { SetKnowledgeSourceNatureRequest } from "../../application/set-knowledge-source-nature.contracts"
import type { KnowledgeSourceNatureAnswerType } from "./dto/knowledge-source-nature-answer.type"
import type { SetKnowledgeSourceNatureInput } from "./dto/set-knowledge-source-nature.input"

/** Maps the GraphQL input to the request. */
export const toSetKnowledgeSourceNatureRequest = (
    workspaceId: string,
    input: SetKnowledgeSourceNatureInput,
): SetKnowledgeSourceNatureRequest => ({ workspaceId, sourceId: input.sourceId, nature: input.nature })

/** Maps the answer to the GraphQL type. */
export const toKnowledgeSourceNatureAnswerType = (result: NatureAnswered): KnowledgeSourceNatureAnswerType => ({
    id: result.id,
    reopened: result.reopened,
})
