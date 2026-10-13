import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { LeadReadService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { conversionSinceIso } from "./leadgen-conversation.policy"
import type { LeadGenWorkbench, LeadGenWorkbenchSelection } from "./leadgen-workbench.contracts"
import { buildLeadGenWorkbench } from "./leadgen-workbench.mapper"

@Injectable()
/** The prospect, source, comment and handoff projection for a workspace member. */
export class LeadGenWorkbenchService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadReadService,
        private readonly workItems: WorkItemsService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Reads the workspace's workbench, optionally selecting one installed Lead Gen agent. */
    async read(principalId: string, selection: LeadGenWorkbenchSelection): Promise<LeadGenWorkbench> {
        const { workspaceId } = selection
        const installationId = selection.installationId ?? null
        await this.members.require(principalId, workspaceId)
        const nowMs = this.clock.now().getTime()
        const [leads, items, conversations] = await Promise.all([
            this.leads.list(workspaceId),
            this.workItems.listForWorkbench(workspaceId, 600),
            this.conversations.listCustomerLeadConversations(workspaceId, 1000),
        ])
        const messages = await this.messages.listForConversations(
            workspaceId,
            conversations.map((row) => row.id),
            {
                since: conversionSinceIso(nowMs),
                limit: 8000,
                oldestFirst: true,
            },
        )
        return buildLeadGenWorkbench({ nowMs, installationId, leads, items, conversations, messages })
    }
}
