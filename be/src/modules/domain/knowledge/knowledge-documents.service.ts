import { Injectable } from "@nestjs/common"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { OpenedKnowledgeSource } from "./knowledge.contracts"

@Injectable()
/** One document of a workspace as the Knowledge page opens it: its text and the passages agents retrieve from it. */
export class KnowledgeDocumentsService {
    constructor(
        private readonly sources: KnowledgeSourcesService,
        private readonly chunks: KnowledgeChunksService,
    ) {}

    /** Reads the document with its passages; any member may read it, and a document of another workspace is not found. */
    async document(userId: string, workspaceId: string, sourceId: string): Promise<OpenedKnowledgeSource> {
        const source = await this.sources.detail(userId, workspaceId, sourceId)
        const chunks = await this.chunks.passagesOf(workspaceId, sourceId)
        return { source, chunks }
    }
}
