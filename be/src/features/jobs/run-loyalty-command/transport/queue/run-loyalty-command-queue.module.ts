import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunLoyaltyCommandModule } from "../../run-loyalty-command.module"
import { RunLoyaltyCommandProcessor } from "./run-loyalty-command.processor"

@Module({ imports: [RunLoyaltyCommandModule], providers: [RunLoyaltyCommandProcessor] })
/** The queue transport of the run-loyalty-command job: registers its processor with the job runner, which an api or worker app composes; the definer functions of the loyalty commands feed it. */
export class RunLoyaltyCommandQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunLoyaltyCommandProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
