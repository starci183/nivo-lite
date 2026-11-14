import { Injectable } from "@nestjs/common"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { DocumentPartsService } from "./document-parts.service"
import type { KnowledgeSourceListing, KnowledgeSourcesListingRequest } from "./knowledge-sources-listing.contracts"

@Injectable()
/**
 * Lists the documents of the workspace, newest first and without their text, each with what it cost in AI (read, critique, re-read)
 * for an owner or manager; for staff the cost is null and no usage is read. Each document also carries where its truths stand, read
 * for the whole list in one query by primary key; a file cut into several parts shows the truths of ALL its parts rolled up (counts
 * summed, the state of the least advanced part).
 */
export class KnowledgeSourcesListingService {
    constructor(
        private readonly sources: KnowledgeSourcesService,
        private readonly usage: AiUsageOverviewService,
        private readonly truths: DocumentPartsService,
    ) {}

    /** The documents of the workspace the caller may see, each with its AI cost and where its truths stand. */
    async list(principalId: string, request: KnowledgeSourcesListingRequest): Promise<ReadonlyArray<KnowledgeSourceListing>> {
        const listed = await this.sources.list(principalId, request.workspaceId, request.module, request.origin)
        const costs = await this.usage.documentCosts(
            principalId,
            request.workspaceId,
            listed.map((source) => source.id),
        )
        const truths = await this.truths.truthsOf(
            request.workspaceId,
            listed.map((source) => ({ id: source.id, partCount: source.partCount })),
        )
        return listed.map((source) => ({
            ...source,
            aiCost: costs?.get(source.id) ?? null,
            truths: truths.get(source.id) ?? null,
        }))
    }
}
