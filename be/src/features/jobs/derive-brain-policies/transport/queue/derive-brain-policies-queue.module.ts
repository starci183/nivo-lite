import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { DeriveBrainPoliciesModule } from "../../derive-brain-policies.module"
import { ConfigurableModuleClass } from "./derive-brain-policies-queue.module-definition"
import { DeriveBrainPoliciesProcessor } from "./derive-brain-policies.processor"

@Module({ imports: [DeriveBrainPoliciesModule.register({})], providers: [DeriveBrainPoliciesProcessor] })
/** The queue transport of the derive-brain-policies job: registers its processor with the job runner. */
export class DeriveBrainPoliciesQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DeriveBrainPoliciesProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
