import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunChatTurnModule } from "../../run-chat-turn.module"
import { ConfigurableModuleClass } from "./run-chat-turn-queue.module-definition"
import { RunChatTurnProcessor } from "./run-chat-turn.processor"

@Module({ imports: [RunChatTurnModule.register({})], providers: [RunChatTurnProcessor] })
/** The queue transport of the run-chat-turn job: registers its processor with the job runner, which an api or worker app composes; a new customer message enqueues it. */
export class RunChatTurnQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunChatTurnProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
