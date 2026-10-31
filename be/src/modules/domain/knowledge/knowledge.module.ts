import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeDocumentsService } from "./knowledge-documents.service"
import { KnowledgeDriveService } from "./knowledge-drive.service"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { KnowledgeJobsService } from "./knowledge-jobs.service"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { KnowledgeSearchService } from "./knowledge-search.service"
import { UnchangedSourceService } from "./unchanged-source.service"
import { DRIVE_ACCESS_SOURCE } from "./knowledge.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge.module-definition"
import { SourceReaderService } from "./source-reader.service"
import { UsageMeterService } from "./usage-meter.service"

@Module({})
/** Indexing, searching and metering the knowledge of a workspace and the base knowledge of NIVO. */
export class KnowledgeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: DRIVE_ACCESS_SOURCE, useExisting: options.driveAccess },
                UsageMeterService,
                EmbeddingService,
                SourceReaderService,
                KnowledgeDocumentsService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                KnowledgeSearchService,
                UnchangedSourceService,
            ],
            exports: [
                UsageMeterService,
                EmbeddingService,
                KnowledgeDocumentsService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                KnowledgeSearchService,
            ],
        }
    }
}
