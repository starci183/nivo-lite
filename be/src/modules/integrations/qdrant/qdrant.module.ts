import { Module, type DynamicModule } from "@nestjs/common"
import { QdrantBootService } from "./qdrant-boot.service"
import { QdrantClient } from "./qdrant.client"
import { QDRANT_ENDPOINT, VECTOR_INDEX, VECTOR_INDEX_BOOT } from "./qdrant.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./qdrant.module-definition"

@Module({})
/**
 * The Qdrant integration: the vector index of the app. Without `QDRANT_URL` it registers no client and `VECTOR_INDEX` is null, so
 * the app boots and the meaning search answers from Postgres. With it, the collections are prepared when the app starts
 * (`QdrantBootService`): a collection of another vector size refuses the start, an unreachable service does not.
 */
export class QdrantModule extends ConfigurableModuleClass {
    /** Registers the index once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { url } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...(url === null
                    ? [
                          { provide: VECTOR_INDEX, useValue: null },
                          { provide: VECTOR_INDEX_BOOT, useValue: null },
                      ]
                    : [
                          { provide: QDRANT_ENDPOINT, useValue: { ...options, url } },
                          QdrantClient,
                          QdrantBootService,
                          { provide: VECTOR_INDEX, useExisting: QdrantClient },
                          { provide: VECTOR_INDEX_BOOT, useExisting: QdrantBootService },
                      ]),
            ],
            exports: [VECTOR_INDEX, VECTOR_INDEX_BOOT],
        }
    }
}
