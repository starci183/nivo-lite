import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ApplyBookingStatusModule } from "../../apply-booking-status.module"
import { ApplyBookingStatusProcessor } from "./apply-booking-status.processor"

@Module({ imports: [ApplyBookingStatusModule], providers: [ApplyBookingStatusProcessor] })
/** The queue transport of the apply-booking-status job: registers its processor with the job runner, which an api or worker app composes; the trigger of `bookings` feeds it. */
export class ApplyBookingStatusQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ApplyBookingStatusProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
