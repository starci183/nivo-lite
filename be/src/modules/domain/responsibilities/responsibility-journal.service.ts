import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectAgentDirectory } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import type {
    NewResponsibility,
    OptionalResponsibility,
    ResponsibilityListing,
    ResponsibilityRecord,
    ResponsibilityScope,
    ResponsibilityStatus,
} from "./responsibility-journal.contracts"
import type { AgentNameRow, LeadNameRow } from "./persistence/responsibility-journal.rows"
import {
    FIND_AGENT_NAME,
    FIND_LEAD_NAME,
    FIND_OPEN_RESPONSIBILITY,
    FIND_RESPONSIBILITY,
    INSERT_RESPONSIBILITY,
    LIST_RESPONSIBILITIES,
    UPDATE_RESPONSIBILITY_NEXT_ACTION,
    UPDATE_RESPONSIBILITY_STATUS,
} from "./persistence/responsibility-journal.sql"

const DAY_MS = 86_400_000

@Injectable()
/** What somebody owes a customer: the follow-up every new customer gets and the board the Responsibilities page shows. */
export class ResponsibilityJournalService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAgentDirectory() private readonly agents: AgentDirectory,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
    ) {}

    /**
     * The customer's open responsibility, created when there is none: owned by the workspace's Sales agent, or by the actor
     * when there is no agent, due in a day.
     */
    async ensureFor(ctx: ResponsibilityScope, leadId: string): Promise<ResponsibilityRecord> {
        const open = (
            await this.entityManager.query<Array<ResponsibilityRecord>>(FIND_OPEN_RESPONSIBILITY, [
                ctx.workspaceId,
                leadId,
            ])
        )[0]
        if (open !== undefined) return open
        const lead = (await this.entityManager.query<Array<LeadNameRow>>(FIND_LEAD_NAME, [ctx.workspaceId, leadId]))[0]
        if (lead === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        const sales = await this.agents.agentOfDepartment(ctx.workspaceId, "sales", null)
        return this.insert(
            ctx.workspaceId,
            {
                lead_id: leadId,
                title: this.catalog.get("responsibility.title", { name: lead.contact_name }, ctx.locale),
                owner: sales?.id ?? "human",
                next_action: this.catalog.get("responsibility.next", {}, ctx.locale),
                due_at: new Date(this.clock.now().getTime() + DAY_MS).toISOString(),
            },
            sales?.name ?? ctx.actor,
        )
    }

    /** The workspace's responsibilities with their customer, open ones first. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<ResponsibilityListing>> {
        await this.members.require(principalId, workspaceId)
        return this.entityManager.query<Array<ResponsibilityListing>>(LIST_RESPONSIBILITIES, [workspaceId])
    }

    /** Adds a responsibility for a customer of the workspace, owned by the caller or by one of the workspace's agents. */
    async create(principalId: string, workspaceId: string, input: NewResponsibility): Promise<ResponsibilityRecord> {
        const member = await this.members.require(principalId, workspaceId)
        const agent = input.owner === "human" ? null : await this.agentOf(workspaceId, input.owner)
        const created = await this.insert(workspaceId, input, agent?.name ?? member.displayName)
        await this.events.record({
            workspaceId,
            kind: "responsibility.assigned",
            actor: member.displayName,
            summary: `${created.owner_name}: ${created.next_action}`,
            leadId: input.lead_id,
        })
        return created
    }

    /** Moves one of the workspace's responsibilities to a status. */
    async updateStatus(
        principalId: string,
        workspaceId: string,
        responsibilityId: string,
        status: ResponsibilityStatus,
    ): Promise<ResponsibilityRecord> {
        await this.members.require(principalId, workspaceId)
        const row = (
            await this.entityManager.query<Array<ResponsibilityRecord>>(UPDATE_RESPONSIBILITY_STATUS, [
                workspaceId,
                responsibilityId,
                status,
            ])
        )[0]
        if (row === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return row
    }

    /** Marks one of the workspace's responsibilities as waiting for the owner's approval; the card is open. */
    async markWaitingApproval(scope: ResponsibilityScope, responsibilityId: string): Promise<void> {
        await this.entityManager.query(UPDATE_RESPONSIBILITY_STATUS, [
            scope.workspaceId,
            responsibilityId,
            "waiting_approval",
        ])
    }

    /** One responsibility of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, responsibilityId: string): Promise<OptionalResponsibility> {
        const rows = await this.entityManager.query<Array<ResponsibilityRecord>>(FIND_RESPONSIBILITY, [
            workspaceId,
            responsibilityId,
        ])
        return rows[0] ?? null
    }

    /** Moves a responsibility to a status on the engine's behalf; the engine already proved who may act. */
    async setStatus(scope: ResponsibilityScope, responsibilityId: string, status: ResponsibilityStatus): Promise<void> {
        await this.entityManager.query(UPDATE_RESPONSIBILITY_STATUS, [scope.workspaceId, responsibilityId, status])
    }

    /** Sets the next step of a responsibility. */
    async setNextAction(scope: ResponsibilityScope, responsibilityId: string, nextAction: string): Promise<void> {
        await this.entityManager.query(UPDATE_RESPONSIBILITY_NEXT_ACTION, [
            scope.workspaceId,
            responsibilityId,
            nextAction,
        ])
    }

    private async agentOf(workspaceId: string, agentId: string): Promise<AgentNameRow> {
        const agent = (await this.entityManager.query<Array<AgentNameRow>>(FIND_AGENT_NAME, [workspaceId, agentId]))[0]
        if (agent === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return agent
    }

    private async insert(
        workspaceId: string,
        input: NewResponsibility,
        ownerName: string,
    ): Promise<ResponsibilityRecord> {
        const ownerAgentId = input.owner === "human" ? null : input.owner
        const row = (
            await this.entityManager.query<Array<ResponsibilityRecord>>(INSERT_RESPONSIBILITY, [
                workspaceId,
                input.lead_id,
                input.title,
                ownerAgentId === null ? "human" : "agent",
                ownerAgentId,
                ownerName,
                input.next_action,
                input.due_at,
            ])
        )[0]
        if (row === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return row
    }
}
