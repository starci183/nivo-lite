import { Module, type DynamicModule } from "@nestjs/common"
import { BrainChangeRequestsService } from "./brain-change-requests.service"
import { BrainFactAreasService } from "./brain-fact-areas.service"
import { BrainFactBatchService } from "./brain-fact-batch.service"
import { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
import { FactVectorRowsService } from "./fact-vector-rows.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsPagingService } from "./brain-facts-paging.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
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
                BrainFactAreasService,
                InForceBoundService,
                BrainFactsReadService,
                BrainFactsPagingService,
                BrainFactsMaintenanceService,
                BrainFactBatchService,
                BrainFactRelationsService,
                BrainChangeRequestsService,
                BrainFactEmbeddingsService,
                FactVectorRowsService,
            ],
            exports: [
                BrainFactsService,
                BrainFactAreasService,
                BrainFactsReadService,
                BrainFactsPagingService,
                BrainFactBatchService,
                BrainFactRelationsService,
                BrainChangeRequestsService,
                BrainFactEmbeddingsService,
                FactVectorRowsService,
            ],
        }
    }
}
