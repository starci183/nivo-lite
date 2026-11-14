import { Module } from "@nestjs/common"
import { VECTOR_SYNC_QUEUE_PRODUCER } from "./vector-sync.decorators"
import { ConfigurableModuleClass } from "./vector-sync.module-definition"
import { VectorSyncQueue } from "./vector-sync.queue"

@Module({
    providers: [VectorSyncQueue, { provide: VECTOR_SYNC_QUEUE_PRODUCER, useExisting: VectorSyncQueue }],
    exports: [VectorSyncQueue, VECTOR_SYNC_QUEUE_PRODUCER],
})
/** The vector-sync queue: its typed producer, imported and exported by the vector-sync capability. */
export class VectorSyncQueueModule extends ConfigurableModuleClass {}
