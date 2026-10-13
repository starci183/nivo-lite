import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { EmitN8nEventModule } from "../../emit-n8n-event.module"
import { EmitN8nEventProcessor } from "./emit-n8n-event.processor"

@Module({ imports: [EmitN8nEventModule], providers: [EmitN8nEventProcessor] })
/** The queue transport of the emit-n8n-event job: registers its processor with the job runner, which the api or worker app composes. */
export class EmitN8nEventQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: EmitN8nEventProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
