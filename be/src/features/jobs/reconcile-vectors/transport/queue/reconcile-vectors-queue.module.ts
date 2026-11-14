import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { ReconcileVectorsModule } from "../../reconcile-vectors.module"
import { ConfigurableModuleClass } from "./reconcile-vectors-queue.module-definition"
import { ReconcileVectorsProcessor } from "./reconcile-vectors.processor"

@Module({ imports: [ReconcileVectorsModule.register({})], providers: [ReconcileVectorsProcessor] })
/** The queue transport of the reconcile-vectors job: registers its processor with the job runner. */
export class ReconcileVectorsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReconcileVectorsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
