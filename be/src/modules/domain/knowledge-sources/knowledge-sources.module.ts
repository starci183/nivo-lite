import { Module, type DynamicModule } from "@nestjs/common"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
import { BlockedSourcesService } from "./blocked-sources.service"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-sources.module-definition"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import { SourceCategoriesService } from "./source-categories.service"
import { SourceCriticStageService } from "./source-critic-stage.service"
import { SourcePartsService } from "./source-parts.service"
import { SourceQuotaService } from "./source-quota.service"
import { SourceReadingsService } from "./source-readings.service"
import { SourceTwinsService } from "./source-twins.service"
import { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"
import { KnowledgeSourceCitesService } from "./knowledge-source-cites.service"
import { KnowledgeSourcesAdminReadService } from "./knowledge-sources-admin-read.service"
import { KnowledgeSourcesReadService } from "./knowledge-sources-read.service"
import { ProfileSourcesService } from "./profile-sources.service"
import { PublishedSourcesService } from "./published-sources.service"

@Module({})
/** The documents of a workspace: their rows, their stages and the jobs that index them. */
export class KnowledgeSourcesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the read-only mode registers the reads only, with no storage and no queue. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.seedOnly === true) {
            return {
                ...base,
                imports: [...(base.imports ?? []), KnowledgeQueueModule.register({})],
                providers: [...(base.providers ?? []), ProfileSourcesService],
                exports: [ProfileSourcesService],
            }
        }
        if (options.readOnly === true) {
            return {
                ...base,
                providers: [
                    ...(base.providers ?? []),
                    KnowledgeSourcesReadService,
                    KnowledgeSourcesReadableService,
                    KnowledgeSourceCitesService,
                ],
                exports: [
                    KnowledgeSourcesReadService,
                    KnowledgeSourcesReadableService,
                    KnowledgeSourceCitesService,
                ],
            }
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), KnowledgeQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                KnowledgeSourcesAdminReadService,
                KnowledgeSourcesReadService,
                KnowledgeSourcesReadableService,
                KnowledgeSourceCitesService,
                { provide: KNOWLEDGE_STORAGE, useExisting: options.storage },
                KnowledgeSourcesService,
                BlockedSourcesService,
                KnowledgeProgressService,
                SourceCriticStageService,
                SourceQuotaService,
                SourceReadingsService,
                SourcePartsService,
                SourceTwinsService,
                SourceCategoriesService,
                ApiKnowledgeSourcesService,
                PublishedSourcesService,
            ],
            exports: [
                KnowledgeQueueModule,
                KnowledgeSourcesAdminReadService,
                KnowledgeSourcesReadService,
                KnowledgeSourcesReadableService,
                KnowledgeSourceCitesService,
                KnowledgeSourcesService,
                BlockedSourcesService,
                KnowledgeProgressService,
                SourceCriticStageService,
                SourceQuotaService,
                SourceReadingsService,
                SourcePartsService,
                SourceTwinsService,
                SourceCategoriesService,
                ApiKnowledgeSourcesService,
                PublishedSourcesService,
            ],
        }
    }
}
