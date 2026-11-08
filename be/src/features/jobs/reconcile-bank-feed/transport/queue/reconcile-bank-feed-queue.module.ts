import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { ReconcileBankFeedModule } from "../../reconcile-bank-feed.module"
import { ConfigurableModuleClass } from "./reconcile-bank-feed-queue.module-definition"
import { ReconcileBankFeedProcessor } from "./reconcile-bank-feed.processor"

@Module({ imports: [ReconcileBankFeedModule.register({})], providers: [ReconcileBankFeedProcessor] })
/** The queue transport of the reconcile-bank-feed job: registers its processor with the job runner; the scheduler tick and the ready trigger enqueue it. */
export class ReconcileBankFeedQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReconcileBankFeedProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
