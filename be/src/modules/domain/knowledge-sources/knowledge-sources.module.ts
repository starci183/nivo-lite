import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KNOWLEDGE_STORAGE } from "./knowledge-sources.decorators"
import { DossierSourcesService } from "./dossier-sources.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./knowledge-sources.module-definition"
import { KnowledgeSourcesService } from "./knowledge-sources.service"
import { SourceCategoriesService } from "./source-categories.service"
import { SourcePartsService } from "./source-parts.service"
import { SourceQuotaService } from "./source-quota.service"
import { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"
import { KnowledgeSourcesAdminReadService } from "./knowledge-sources-admin-read.service"
import { KnowledgeSourcesReadService } from "./knowledge-sources-read.service"

@Module({})
/** The documents of a workspace: their rows, their stages and the jobs that index them. */
export class KnowledgeSourcesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the read-only mode registers the reads only, with no storage and no queue. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.readOnly === true) {
            return {
                ...base,
                providers: [
                    ...(base.providers ?? []),
                    KnowledgeSourcesReadService,
                    KnowledgeSourcesReadableService,
                    DossierSourcesService,
                ],
                exports: [KnowledgeSourcesReadService, KnowledgeSourcesReadableService, DossierSourcesService],
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
                { provide: KNOWLEDGE_STORAGE, useExisting: options.storage },
                KnowledgeSourcesService,
                KnowledgeProgressService,
                SourceQuotaService,
                SourcePartsService,
                SourceCategoriesService,
                DossierSourcesService,
                ApiKnowledgeSourcesService,
            ],
            exports: [
                KnowledgeQueueModule,
                KnowledgeSourcesAdminReadService,
                KnowledgeSourcesReadService,
                KnowledgeSourcesReadableService,
                KnowledgeSourcesService,
                KnowledgeProgressService,
                SourceQuotaService,
                SourcePartsService,
                SourceCategoriesService,
                DossierSourcesService,
                ApiKnowledgeSourcesService,
            ],
        }
    }
}
