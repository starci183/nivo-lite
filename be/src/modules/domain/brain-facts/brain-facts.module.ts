import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BrainChangeRequestsService } from "./brain-change-requests.service"
import { BrainFactBatchService } from "./brain-fact-batch.service"
import { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-facts.module-definition"

@Module({})
/** What is true about a business: the truth graph agents answer from, its facts with source, trust, validity and version, and their relations. */
export class BrainFactsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                BrainFactsService,
                BrainFactsReadService,
                BrainFactsMaintenanceService,
                BrainFactBatchService,
                BrainFactRelationsService,
                BrainChangeRequestsService,
                BrainFactEmbeddingsService,
            ],
            exports: [
                BrainFactsService,
                BrainFactsReadService,
                BrainFactBatchService,
                BrainFactRelationsService,
                BrainChangeRequestsService,
                BrainFactEmbeddingsService,
            ],
        }
    }
}
