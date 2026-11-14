import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { PollDueConnectionsModule } from "../../poll-due-connections.module"
import { ConfigurableModuleClass } from "./poll-due-connections-queue.module-definition"
import { PollDueConnectionsProcessor } from "./poll-due-connections.processor"

@Module({ imports: [PollDueConnectionsModule.register({})], providers: [PollDueConnectionsProcessor] })
/** The queue transport of the poll-due-connections job: registers its processor with the job runner; the scheduler tick and the ready trigger enqueue it. */
export class PollDueConnectionsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: PollDueConnectionsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
