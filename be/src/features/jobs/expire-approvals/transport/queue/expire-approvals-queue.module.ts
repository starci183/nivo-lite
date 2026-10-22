import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ExpireApprovalsModule } from "../../expire-approvals.module"
import { ConfigurableModuleClass } from "./expire-approvals-queue.module-definition"
import { ExpireApprovalsProcessor } from "./expire-approvals.processor"

@Module({ imports: [ExpireApprovalsModule.register({})], providers: [ExpireApprovalsProcessor] })
/** The queue transport of the expire-approvals job: registers its processor with the job runner, which an api or worker app composes. */
export class ExpireApprovalsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ExpireApprovalsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
