import { Module, type DynamicModule } from "@nestjs/common"
import { DocumentReadersModule } from "@modules/integrations/document-readers"
import { DocumentTranscriptionService } from "./document-transcription.service"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeDocumentsService } from "./knowledge-documents.service"
import { KnowledgeDriveService } from "./knowledge-drive.service"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { KnowledgeJobsService } from "./knowledge-jobs.service"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { KnowledgeSearchService } from "./knowledge-search.service"
import { PassageRetrievalService } from "./passage-retrieval.service"
import { UnchangedSourceService } from "./unchanged-source.service"
import { DRIVE_ACCESS_SOURCE } from "./knowledge.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge.module-definition"
import { SourceReaderService } from "./source-reader.service"
import { UsageMeterService } from "./usage-meter.service"
import { VectorEmbedderService } from "./vector-embedder.service"

@Module({})
/** Indexing, searching and metering the knowledge of a workspace and the base knowledge of NIVO. */
export class KnowledgeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the search-only mode registers the metered embedding and the search alone. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.searchOnly === true) {
            return {
                ...base,
                providers: [
                    ...(base.providers ?? []),
                    UsageMeterService,
                    EmbeddingService,
                    PassageRetrievalService,
                    KnowledgeSearchService,
                    VectorEmbedderService,
                ],
                exports: [
                    UsageMeterService,
                    EmbeddingService,
                    PassageRetrievalService,
                    KnowledgeSearchService,
                    VectorEmbedderService,
                ],
            }
        }
        return {
            ...base,
            // The readers of uploaded files belong to the indexing side alone; the search-only mode never reads a file.
            imports: [...(base.imports ?? []), DocumentReadersModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: DRIVE_ACCESS_SOURCE, useExisting: options.driveAccess },
                DocumentTranscriptionService,
                UsageMeterService,
                EmbeddingService,
                SourceReaderService,
                KnowledgeDocumentsService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                PassageRetrievalService,
                KnowledgeSearchService,
                UnchangedSourceService,
                VectorEmbedderService,
            ],
            exports: [
                UsageMeterService,
                EmbeddingService,
                KnowledgeDocumentsService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                PassageRetrievalService,
                KnowledgeSearchService,
                VectorEmbedderService,
            ],
        }
    }
}
