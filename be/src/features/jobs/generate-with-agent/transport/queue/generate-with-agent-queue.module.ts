import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { GenerateWithAgentModule } from "../../generate-with-agent.module"
import { GenerateWithAgentProcessor } from "./generate-with-agent.processor"

@Module({ imports: [GenerateWithAgentModule], providers: [GenerateWithAgentProcessor] })
/** The queue transport of the generate-with-agent job: registers its processor with the job runner, which an api or worker app composes. */
export class GenerateWithAgentQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: GenerateWithAgentProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
