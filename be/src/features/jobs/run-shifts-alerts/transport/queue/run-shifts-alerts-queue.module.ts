import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunShiftsAlertsModule } from "../../run-shifts-alerts.module"
import { ConfigurableModuleClass } from "./run-shifts-alerts-queue.module-definition"
import { RunShiftsAlertsProcessor } from "./run-shifts-alerts.processor"

@Module({ imports: [RunShiftsAlertsModule.register({})], providers: [RunShiftsAlertsProcessor] })
/** The queue transport of the run-shifts-alerts job: registers its processor with the job runner, which the api or worker app composes. */
export class RunShiftsAlertsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunShiftsAlertsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
