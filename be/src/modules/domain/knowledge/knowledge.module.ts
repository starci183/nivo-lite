import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeDriveService } from "./knowledge-drive.service"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { KnowledgeJobsService } from "./knowledge-jobs.service"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { KnowledgeSearchService } from "./knowledge-search.service"
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
                UsageMeterService,
                EmbeddingService,
                SourceReaderService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                KnowledgeSearchService,
            ],
            exports: [
                UsageMeterService,
                EmbeddingService,
                KnowledgeDriveService,
                KnowledgeIndexingService,
                KnowledgeJobsService,
                KnowledgeReembedService,
                KnowledgeSearchService,
            ],
        }
    }
}
