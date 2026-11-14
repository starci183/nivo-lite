import { Injectable } from "@nestjs/common"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { KnowledgeDocumentsService } from "./knowledge-documents.service"
import type { KnowledgeSourceRead } from "./knowledge-source-read.contracts"

@Injectable()
/** Reads one document of the workspace with its text and its passages, and what it cost in AI for an owner or manager (null for staff). */
export class KnowledgeSourceReadService {
    constructor(
        private readonly documents: KnowledgeDocumentsService,
        private readonly usage: AiUsageOverviewService,
    ) {}

    /** The document, opened for the caller, with its AI cost. */
    async read(principalId: string, workspaceId: string, id: string): Promise<KnowledgeSourceRead> {
        const opened = await this.documents.document(principalId, workspaceId, id)
        const costs = await this.usage.documentCosts(principalId, workspaceId, [id])
        return { ...opened, aiCost: costs?.get(id) ?? null }
    }
}
