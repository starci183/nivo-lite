import { Injectable } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ExecutionsService } from "@modules/domain/executions"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { LeadJourneyData } from "./lead-journey.contracts"
import { LeadReadService } from "@modules/domain/leads"

@Injectable()
/** The authorized read of a customer's steps, drafts, evidence and possible owners. */
export class LeadJourneyService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadReadService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly events: EventsService,
        private readonly agents: AgentsService,
        private readonly executions: ExecutionsService,
    ) {}

    /** Verifies membership and the lead's workspace before reading the journey's owned records. */
    async read(principalId: string, workspaceId: string, leadId: string): Promise<LeadJourneyData> {
        await this.members.require(principalId, workspaceId)
        const lead = await this.leads.require(workspaceId, leadId)
        const [responsibilities, events, agents] = await Promise.all([
            this.responsibilities.listForLead(workspaceId, leadId),
            this.events.list(workspaceId, { leadId, limit: 500 }),
            this.agents.list(principalId, workspaceId),
        ])
        const executions = await this.executions.list(workspaceId, {
            responsibilityIds: responsibilities.map((step) => step.id),
            limit: 500,
        })
        return { lead, responsibilities, executions, events, agents: agents.slice(0, 200) }
    }
}
