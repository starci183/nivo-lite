import { Module, type DynamicModule } from "@nestjs/common"
import { VectorSyncQueueModule } from "@modules/queues/vector-sync"
import { NivoFolderClient } from "./nivo-folder.client"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./nivo-knowledge.module-definition"
import { NivoKnowledgeSearchService } from "./nivo-knowledge-search.service"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoSeedService } from "./nivo-seed.service"
import { NivoVectorRowsService } from "./nivo-vector-rows.service"

@Module({})
/**
 * The base knowledge of NIVO: the playbooks every workspace's agents read next to the business documents, and their publishing. Its
 * items are an embedded row kind (`base`): their points live in the vector index, written by the sync jobs every publish commits.
 */
export class NivoKnowledgeModule extends ConfigurableModuleClass {
    /**
     * Registers the capability once per app; the search-only mode registers the search of the base knowledge alone, the publish-only
     * mode its publishing alone.
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if ("searchOnly" in options && options.searchOnly === true) {
            return {
                ...base,
                providers: [...(base.providers ?? []), NivoKnowledgeSearchService],
                exports: [NivoKnowledgeSearchService],
            }
        }
        if ("publishOnly" in options && options.publishOnly === true) {
            return {
                ...base,
                imports: [...(base.imports ?? []), VectorSyncQueueModule.register({})],
                providers: [...(base.providers ?? []), NivoKnowledgeService, NivoFolderClient, NivoSeedService],
                exports: [NivoKnowledgeService, NivoSeedService],
            }
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), VectorSyncQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                NivoKnowledgeService,
                NivoKnowledgeSearchService,
                NivoFolderClient,
                NivoSeedService,
                NivoVectorRowsService,
            ],
            exports: [NivoKnowledgeService, NivoKnowledgeSearchService, NivoSeedService, NivoVectorRowsService],
        }
    }
}
