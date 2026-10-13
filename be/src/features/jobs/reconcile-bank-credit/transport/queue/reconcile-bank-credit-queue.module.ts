import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ReconcileBankCreditModule } from "../../reconcile-bank-credit.module"
import { ReconcileBankCreditProcessor } from "./reconcile-bank-credit.processor"

@Module({ imports: [ReconcileBankCreditModule], providers: [ReconcileBankCreditProcessor] })
/** The queue transport of the reconcile-bank-credit job: registers its processor with the job runner, which an api or worker app composes; a new credit enqueues it. */
export class ReconcileBankCreditQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReconcileBankCreditProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
