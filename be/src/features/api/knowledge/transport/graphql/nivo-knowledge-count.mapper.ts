import type { NivoKnowledgeCountRequest } from "../../application/nivo-knowledge-count.contracts"
import type { NivoKnowledgeCountInput } from "./dto/nivo-knowledge-count.input"

/** Maps the GraphQL arguments of nivoKnowledgeCount to the request. */
export const toNivoKnowledgeCountRequest = (input: NivoKnowledgeCountInput): NivoKnowledgeCountRequest => ({
    module: input.module,
})
