import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { AcceptMetaEventModule } from "../../accept-meta-event.module"
import { AcceptMetaEventProcessor } from "./accept-meta-event.processor"

@Module({ imports: [AcceptMetaEventModule], providers: [AcceptMetaEventProcessor] })
/** The queue transport of the accept-meta-event job: registers its processor with the job runner; the Meta intake feeds it. */
export class AcceptMetaEventQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: AcceptMetaEventProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
