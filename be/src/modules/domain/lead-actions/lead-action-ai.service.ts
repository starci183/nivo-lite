import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { LeadRecordsService } from "@modules/domain/leads"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectDeepseekClient } from "@modules/integrations/deepseek"
import type { DeepseekClient } from "@modules/integrations/deepseek"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { WorkContext } from "@modules/domain/decisions"
import { LeadActionsError } from "./errors/lead-actions.error"
import type { LeadActionResult } from "./lead-actions.contracts"
import { ownerProposalOf } from "./lead-owner-proposal.policy"

const HISTORY_LIMIT = 500
const DAY_MS = 86_400_000

@Injectable()
/** The AI briefs and proposed owners of a lead, reached only by a claimed backend job. */
export class LeadActionAiService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly leads: LeadRecordsService,
        private readonly events: EventsService,
        private readonly agents: AgentsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly messages: MessagesService,
        private readonly members: WorkspaceMembersService,
        @InjectDeepseekClient() private readonly ai: DeepseekClient,
    ) {}

    /** Regenerates the customer's brief and records the brief and evidence together after the model answers. */
    async refreshContext(ctx: WorkContext, leadId: string): Promise<LeadActionResult> {
        const lead = await this.leads.require(ctx.workspaceId, leadId)
        const history = await this.events.leadHistory(ctx.workspaceId, lead.id, HISTORY_LIMIT)
        const summary = await this.ai.summarizeContext(
            ctx,
            lead,
            history.map((line) => line.summary),
        )
        await this.entityManager.transaction(async (manager) => {
            await this.leads.replaceContext(ctx.workspaceId, lead.id, summary, manager)
            await this.events.record(
                {
                    workspaceId: ctx.workspaceId,
                    leadId: lead.id,
                    kind: "context.summarised",
                    actor: "NIVO AI",
                    summary: this.catalog.get("lead-actions.context", {}, ctx.locale),
                    evidence: summary,
                },
                manager,
            )
        })
        return { leadId: lead.id, contextSummary: summary }
    }

    /** Proposes one owner and next step for a customer with no open responsibility; a redelivery keeps the existing one. */
    async suggestOwner(ctx: WorkContext, userId: string, leadId: string): Promise<LeadActionResult> {
        const lead = await this.leads.require(ctx.workspaceId, leadId)
        const open = (await this.responsibilities.list(userId, ctx.workspaceId)).find(
            (item) => item.lead_id === lead.id && item.status !== "done",
        )
        if (open !== undefined) return { leadId: lead.id, responsibilityId: open.id }
        const agents = await this.eligibleAgents(userId, ctx.workspaceId)
        const proposal = unwrapOutcome(
            ownerProposalOf(
                await this.ai.proposeResponsibility(ctx, lead, lead.context_summary ?? "", agents, ctx.actor),
            ),
            LeadActionsError,
        )
        const owner =
            proposal.owner_kind === "agent"
                ? (agents.find((agent) => agent.handle === proposal.owner_handle) ?? agents[0])
                : undefined
        return this.entityManager.transaction(async (manager) => {
            const saved = await this.responsibilities.create(
                userId,
                ctx.workspaceId,
                {
                    lead_id: lead.id,
                    title: proposal.title,
                    owner: owner?.id ?? (await this.members.idOf(userId, ctx.workspaceId)),
                    next_action: proposal.next_action,
                    due_at: new Date(this.clock.now().getTime() + proposal.due_in_days * DAY_MS).toISOString(),
                },
                manager,
            )
            await this.events.record(
                {
                    workspaceId: ctx.workspaceId,
                    leadId: lead.id,
                    kind: "responsibility.proposed",
                    actor: "NIVO AI",
                    summary: saved.next_action,
                    evidence: proposal.rationale,
                },
                manager,
            )
            await this.messages.postSystem({
                workspaceId: ctx.workspaceId,
                leadId: lead.id,
                manager,
                body: this.catalog.get(
                    "lead-actions.owner",
                    {
                        name: lead.contact_name,
                        owner: owner === undefined ? saved.owner_name : `@${owner.handle}`,
                        next: saved.next_action,
                    },
                    ctx.locale,
                ),
            })
            return { leadId: lead.id, responsibilityId: saved.id }
        })
    }

    private async eligibleAgents(userId: string, workspaceId: string): Promise<Array<AgentProfile>> {
        const all = (await this.agents.list(userId, workspaceId)).filter((agent) => agent.status === "active")
        const sales = all.filter((agent) => agent.module === "sales")
        const candidates = sales.length === 0 ? all : sales
        const profiles = await Promise.all(candidates.map((agent) => this.agents.profileOf(workspaceId, agent.id)))
        return profiles.filter((profile): profile is AgentProfile => profile !== null)
    }
}
