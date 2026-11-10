import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import type { DriveFolderListing } from "@modules/integrations/documents"
import type { SourceDetail, SourceSummary } from "@modules/domain/knowledge-sources"
import type { DriveFolderType } from "./dto/drive-folder.type"
import type { KnowledgeDocumentAiCostType } from "./dto/knowledge-document-ai-cost.type"
import type { KnowledgeSourceTextType } from "./dto/knowledge-source-text.type"
import type { KnowledgeSourceType } from "./dto/knowledge-source.type"

/** Maps a document of the list to the GraphQL type. */
export const toKnowledgeSourceType = (source: SourceSummary): KnowledgeSourceType => ({
    ...source,
    tags: [...source.tags],
})

/** Maps a document with its text to the GraphQL type. */
export const toKnowledgeSourceTextType = (source: SourceDetail): KnowledgeSourceTextType => {
    const reading = source.reading ?? null
    return {
        ...source,
        tags: [...source.tags],
        reading:
            reading === null
                ? null
                : {
                      reader: reading.reader,
                      pageCount: reading.pageCount,
                      sheetCount: reading.sheetCount,
                      transcribed: reading.transcribed,
                      warnings: reading.warnings.map((warning) => ({ ...warning })),
                      refusal: reading.refusal,
                      reason: reading.reason,
                      readAt: reading.readAt,
                  },
    }
}

/** Maps the listing of a Drive folder to the GraphQL type. */
export const toDriveFolderType = (listing: DriveFolderListing): DriveFolderType => ({
    name: listing.name,
    files: listing.files.map((file) => ({ ...file })),
    truncated: listing.truncated,
})

/** Maps what a document cost in AI to the GraphQL type; null stays null (staff). */
export const toDocumentAiCostType = (cost: DocumentAiCost | null): KnowledgeDocumentAiCostType | null =>
    cost === null
        ? null
        : {
              read: { ...cost.read },
              critique: { ...cost.critique },
              reread: { ...cost.reread },
              total: { ...cost.total },
              models: [...cost.models],
          }
