import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-instances.module-definition"
import { AgentInstanceCreationService } from "./agent-instance-creation.service"
import { AgentKnowledgeCopyService } from "./agent-knowledge-copy.service"
import { AgentSetupCopyService } from "./agent-setup-copy.service"
import { ChannelFrontDoorService } from "./channel-front-door.service"
import { ConversationOwnersService } from "./conversation-owners.service"

@Module({})
/** One role, many agents: creating one more agent of a role, with its own name, picture, handle and channels, or a sibling's setup. */
export class AgentInstancesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            AgentKnowledgeCopyService,
            AgentSetupCopyService,
            AgentInstanceCreationService,
            ChannelFrontDoorService,
            ConversationOwnersService,
        ]
        return {
            ...base,
            providers: [...(base.providers ?? []), ...services],
            exports: services,
        }
    }
}
