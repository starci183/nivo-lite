import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunAgentTurnModule } from "../../run-agent-turn.module"
import { ConfigurableModuleClass } from "./run-agent-turn-queue.module-definition"
import { RunAgentTurnProcessor } from "./run-agent-turn.processor"

@Module({ imports: [RunAgentTurnModule.register({})], providers: [RunAgentTurnProcessor] })
/** The queue transport of the run-agent-turn job: registers its processor with the job runner, which an api or worker app composes; a new wake enqueues it. */
export class RunAgentTurnQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunAgentTurnProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
