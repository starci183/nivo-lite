import { Module, type DynamicModule } from "@nestjs/common"
import { QdrantBootService } from "./qdrant-boot.service"
import { QdrantClient } from "./qdrant.client"
import { QDRANT_ENDPOINT, VECTOR_INDEX, VECTOR_INDEX_BOOT } from "./qdrant.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./qdrant.module-definition"

@Module({})
/**
 * The Qdrant integration: the vector index of the app, a required engine piece (Postgres holds rows and text, the index the only
 * vector of each embedded row). The collections are prepared when the app starts (`QdrantBootService`): a collection of another
 * vector size refuses the start; an unreachable service does not, but readiness refuses traffic (`vectors: down`) until it answers.
 */
export class QdrantModule extends ConfigurableModuleClass {
    /** Registers the index once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: QDRANT_ENDPOINT, useValue: options },
                QdrantClient,
                QdrantBootService,
                { provide: VECTOR_INDEX, useExisting: QdrantClient },
                { provide: VECTOR_INDEX_BOOT, useExisting: QdrantBootService },
            ],
            exports: [VECTOR_INDEX, VECTOR_INDEX_BOOT],
        }
    }
}
