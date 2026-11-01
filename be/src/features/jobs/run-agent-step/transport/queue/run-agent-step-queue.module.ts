import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunAgentStepModule } from "../../run-agent-step.module"
import { ConfigurableModuleClass } from "./run-agent-step-queue.module-definition"
import { RunAgentStepProcessor } from "./run-agent-step.processor"

@Module({ imports: [RunAgentStepModule.register({})], providers: [RunAgentStepProcessor] })
/** The queue transport of the run-agent-step job: registers its processor with the job runner, which an api or worker app composes; a committed step enqueues it. */
export class RunAgentStepQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunAgentStepProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
