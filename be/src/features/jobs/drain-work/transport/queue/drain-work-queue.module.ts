import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { DrainWorkModule } from "../../drain-work.module"
import { DrainWorkProcessor } from "./drain-work.processor"

@Module({ imports: [DrainWorkModule], providers: [DrainWorkProcessor] })
/** The queue transport of the drain-work job: registers its processor with the job runner, which an api or worker app composes. */
export class DrainWorkQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DrainWorkProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
