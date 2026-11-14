import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { ReconcileZaloInboxModule } from "../../reconcile-zalo-inbox.module"
import { ConfigurableModuleClass } from "./reconcile-zalo-inbox-queue.module-definition"
import { ReconcileZaloInboxProcessor } from "./reconcile-zalo-inbox.processor"

@Module({ imports: [ReconcileZaloInboxModule.register({})], providers: [ReconcileZaloInboxProcessor] })
/** The queue transport of the reconcile-zalo-inbox job: registers its processor with the job runner; the scheduler tick and the ready trigger enqueue it. */
export class ReconcileZaloInboxQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReconcileZaloInboxProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
