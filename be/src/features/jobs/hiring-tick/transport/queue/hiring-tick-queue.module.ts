import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { HiringTickModule } from "../../hiring-tick.module"
import { HiringTickProcessor } from "./hiring-tick.processor"

@Module({ imports: [HiringTickModule], providers: [HiringTickProcessor] })
/** The queue transport of the hiring-tick job: registers its processor with the job runner, which an api or worker app composes; the hiring capability feeds it per workspace. */
export class HiringTickQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: HiringTickProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
