import type { AskKnowledgeRequest } from "../../application/ask-knowledge.contracts"
import type { Passage } from "@modules/domain/knowledge"
import type { AskKnowledgeInput } from "./dto/ask-knowledge.input"
import type { RetrievedPassageType } from "./dto/retrieved-passage.type"

/** Maps the GraphQL input to the request. */
export const toAskKnowledgeRequest = (workspaceId: string, input: AskKnowledgeInput): AskKnowledgeRequest => ({
    workspaceId,
    question: input.question,
    module: input.module,
    audience: input.audience,
})

/** Maps the answer to the GraphQL type. */
export const toAskKnowledgeType = (result: ReadonlyArray<Passage>): Array<RetrievedPassageType> =>
    result.map((passage) => ({ ...passage }))
