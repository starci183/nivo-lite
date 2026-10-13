import type { DriveFolderListing } from "@modules/integrations/documents"
import type { SourceDetail, SourceSummary } from "@modules/domain/knowledge-sources"
import type { DriveFolderType } from "./dto/drive-folder.type"
import type { KnowledgeSourceTextType } from "./dto/knowledge-source-text.type"
import type { KnowledgeSourceType } from "./dto/knowledge-source.type"

/** Maps a document of the list to the GraphQL type. */
export const toKnowledgeSourceType = (source: SourceSummary): KnowledgeSourceType => ({
    ...source,
    tags: [...source.tags],
})

/** Maps a document with its text to the GraphQL type. */
export const toKnowledgeSourceTextType = (source: SourceDetail): KnowledgeSourceTextType => ({
    ...source,
    tags: [...source.tags],
})

/** Maps the listing of a Drive folder to the GraphQL type. */
export const toDriveFolderType = (listing: DriveFolderListing): DriveFolderType => ({
    name: listing.name,
    files: listing.files.map((file) => ({ ...file })),
    truncated: listing.truncated,
})
