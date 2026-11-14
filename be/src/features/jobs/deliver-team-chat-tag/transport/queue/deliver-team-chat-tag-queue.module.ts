import { Module, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { TEAM_CHAT_MESSAGE_TRIGGER } from "@modules/domain/team-chat"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { DeliverTeamChatTagModule } from "../../deliver-team-chat-tag.module"
import { ConfigurableModuleClass } from "./deliver-team-chat-tag-queue.module-definition"
import { DeliverTeamChatTagProcessor } from "./deliver-team-chat-tag.processor"

@Module({ imports: [DeliverTeamChatTagModule.register({})], providers: [DeliverTeamChatTagProcessor] })
/** The queue transport of the team-chat-tag job: registers its processor with the job runner of the api; a tagged message enqueues it. */
export class DeliverTeamChatTagQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DeliverTeamChatTagProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry and the team chat's trigger to the declarations (only the api delivers it). */
    onModuleInit(): void {
        this.registry.add(this.processor)
        triggerDeclarations.register(TEAM_CHAT_MESSAGE_TRIGGER)
    }
}
