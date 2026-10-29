import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ApprovalResolvedConsumer } from "./approval-resolved.consumer"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadApprovalOutcomesService } from "./thread-approval-outcomes.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { ThreadAgentPostsService } from "./thread-agent-posts.service"
import { ThreadAssignmentsService } from "./thread-assignments.service"
import { ThreadFeedService } from "./thread-feed.service"
import { ThreadMessagesService } from "./thread-messages.service"
import { AGENT_RULES, APPROVAL_GATE } from "./thread-messages.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./thread-messages.module-definition"

@Module({})
/** What people and agents write in work threads, with the tags they chose. The approval gate and the agent rules are bound by the app root through the options. */
export class ThreadMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: APPROVAL_GATE, useExisting: options.approvalGate },
                { provide: AGENT_RULES, useExisting: options.agentRules },
                { provide: INBOX, useClass: InboxService },
                MentionDirectoryService,
                ThreadMessagesService,
                ThreadApprovalOutcomesService,
                ApprovalResolvedConsumer,
                ThreadApprovalsService,
                ThreadAgentPostsService,
                ThreadAssignmentsService,
                ThreadFeedService,
            ],
            exports: [
                ThreadFeedService,
                ThreadMessagesService,
                ThreadApprovalsService,
                ThreadApprovalOutcomesService,
                ThreadAgentPostsService,
                ThreadAssignmentsService,
                MentionDirectoryService,
            ],
        }
    }
}
