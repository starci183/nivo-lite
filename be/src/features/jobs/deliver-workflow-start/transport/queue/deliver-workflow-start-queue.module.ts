import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { DeliverWorkflowStartModule } from "../../deliver-workflow-start.module"
import { ConfigurableModuleClass } from "./deliver-workflow-start-queue.module-definition"
import { DeliverWorkflowStartProcessor } from "./deliver-workflow-start.processor"

@Module({ imports: [DeliverWorkflowStartModule.register({})], providers: [DeliverWorkflowStartProcessor] })
/**
 * The queue transport of the workflow-start job: registers its processor with the job runner of the api; a person's start enqueues it.
 * The workflow call's declaration is registered by the agent schedules module of the same app.
 */
export class DeliverWorkflowStartQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DeliverWorkflowStartProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
