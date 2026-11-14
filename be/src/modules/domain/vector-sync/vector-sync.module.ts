import { Module, type DynamicModule } from "@nestjs/common"
import { FactVectorRowsService } from "@modules/domain/brain-facts"
import { PassageVectorRowsService } from "@modules/domain/knowledge-chunks"
import { NivoVectorRowsService } from "@modules/domain/nivo-knowledge"
import { VectorSyncQueueModule } from "@modules/queues/vector-sync"
import { VectorReconcileService } from "./vector-reconcile.service"
import {
    VECTOR_DRIFT_REPORTER,
    VECTOR_EMBEDDER,
    VECTOR_ROW_SOURCES,
    type VectorRowSources,
} from "./vector-sync.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./vector-sync.module-definition"
import { VectorSyncService } from "./vector-sync.service"

@Module({})
/**
 * Keeps the vector index in step with Postgres: the sync of the rows a change named, and the reconcile that walks everything. The
 * Postgres side of each kind is the capability that owns the table (passages: knowledge-chunks; truths: brain-facts; base knowledge:
 * nivo-knowledge); the embedding door is the one the composition root hands over.
 */
export class VectorSyncModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), VectorSyncQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                {
                    provide: VECTOR_ROW_SOURCES,
                    useFactory: (
                        passage: PassageVectorRowsService,
                        truth: FactVectorRowsService,
                        base: NivoVectorRowsService,
                    ): VectorRowSources => ({ passage, truth, base }),
                    inject: [PassageVectorRowsService, FactVectorRowsService, NivoVectorRowsService],
                },
                { provide: VECTOR_EMBEDDER, useExisting: options.embedder },
                options.driftReporter === undefined
                    ? { provide: VECTOR_DRIFT_REPORTER, useValue: null }
                    : { provide: VECTOR_DRIFT_REPORTER, useExisting: options.driftReporter },
                VectorSyncService,
                VectorReconcileService,
            ],
            exports: [VectorSyncQueueModule, VectorSyncService, VectorReconcileService],
        }
    }
}
