import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ConnectionCommandsJobModule } from "../../connection-commands.module"
import { ConfigurableModuleClass } from "./connection-commands-queue.module-definition"
import { ConnectionCommandsProcessor } from "./connection-commands.processor"

@Module({ imports: [ConnectionCommandsJobModule.register({})], providers: [ConnectionCommandsProcessor] })
/** The queue transport of the connection-commands job: registers its processor with the job runner, which an api or worker app composes; connection_command_submit feeds it. */
export class ConnectionCommandsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ConnectionCommandsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
