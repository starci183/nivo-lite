import { Injectable } from "@nestjs/common"
import type { KnowledgePassages } from "./agent-tools.contracts"
import type { KnowledgeSearch } from "./agent-tools.port"

@Injectable()
/** The knowledge search of an app whose knowledge lane has not landed: it finds nothing. */
export class UnboundKnowledgeSearchService implements KnowledgeSearch {
    /** An empty answer, so the agent says it does not know. */
    search(): Promise<KnowledgePassages> {
        return Promise.resolve({ passages: "", citations: [] })
    }
}
