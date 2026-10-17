import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { IssueInviteModule } from "../../issue-invite.module"
import { ConfigurableModuleClass } from "./issue-invite-queue.module-definition"
import { IssueInviteProcessor } from "./issue-invite.processor"

@Module({ imports: [IssueInviteModule.register({})], providers: [IssueInviteProcessor] })
/** The queue transport of the issue-invite job: registers its processor with the job runner, which an api or worker app composes; the invitation request functions of the database feed it. */
export class IssueInviteQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: IssueInviteProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
