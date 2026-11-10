import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./team-chat.module-definition"
import { TeamChatAccessService } from "./team-chat-access.service"
import { TeamChatApprovalsService } from "./team-chat-approvals.service"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TeamChatForwardService } from "./team-chat-forward.service"
import { TeamChatReactionsService } from "./team-chat-reactions.service"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatTagsService } from "./team-chat-tags.service"
import { TeamChatViewsService } from "./team-chat-views.service"
import { TEAM_CHAT_STORAGE, TEAM_CHAT_TAGS } from "./team-chat.decorators"
import { TeamChatNativeService } from "./team-chat-native.service"
import { TeamChatDecisionService } from "./team-chat-decision.service"
import { TeamChatRoomsService } from "./team-chat.service"
import { AgentMessagePostExecutorService } from "./agent-message-post-executor.service"

@Module({})
/** The internal team chat: rooms, members, messages, pins and read positions of a workspace. */
export class TeamChatModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...(options.storage === undefined
                    ? []
                    : [{ provide: TEAM_CHAT_STORAGE, useExisting: options.storage }]),
                { provide: TEAM_CHAT_TAGS, useExisting: TeamChatTagsService },
                TeamChatTagsService,
                TeamChatStoreService,
                TeamChatAccessService,
                TeamChatApprovalsService,
                TeamChatViewsService,
                TeamChatCardsService,
                TeamChatAudienceService,
                TeamChatFilesService,
                TeamChatRoomsService,
                TeamChatReactionStoreService,
                TeamChatReactionsService,
                TeamChatForwardService,
                TeamChatDecisionService,
                TeamChatNativeService,
                AgentMessagePostExecutorService,
            ],
            exports: [
                TeamChatRoomsService,
                TeamChatAudienceService,
                TeamChatNativeService,
                TeamChatDecisionService,
                TeamChatReactionsService,
                TeamChatForwardService,
            ],
        }
    }
}
