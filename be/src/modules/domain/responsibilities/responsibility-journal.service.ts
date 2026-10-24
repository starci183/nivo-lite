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
import type { ResolvedOwner } from "./responsibility-owner.policy"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"
import type {
    NamedFollowUp,
    NewResponsibility,
    OptionalResponsibility,
    ResponsibilityListing,
    ResponsibilityRecord,
    ResponsibilityScope,
    ResponsibilityStatus,
} from "./responsibility-journal.contracts"
import type { LeadNameRow, ResponsibilityIdRow } from "./persistence/responsibility-journal.rows"
import {
    FIND_LEAD_NAME,
    FIND_OPEN_RESPONSIBILITY,
    FIND_OPEN_TITLED_RESPONSIBILITY,
    FIND_RESPONSIBILITY,
    INSERT_RESPONSIBILITY,
    LIST_RESPONSIBILITIES,
    LIST_LEAD_RESPONSIBILITIES,
    LIST_OPEN_RESPONSIBILITIES,
    LIST_BOARD_RESPONSIBILITIES,
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
        private readonly owners: ResponsibilityOwnersService,
    ) {}

    /**
     * The customer's open responsibility, created when there is none: owned by the workspace's Sales agent, or by the workspace
     * owner (a concrete member) when there is no agent, due in a day.
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
        const owner: ResolvedOwner =
            sales === null
                ? await this.owners.workspaceOwner(ctx.workspaceId)
                : { kind: "agent", agentId: sales.id, memberId: null, name: sales.name }
        return this.insert(
            ctx.workspaceId,
            {
                lead_id: leadId,
                title: this.catalog.get("responsibility.title", { name: lead.contact_name }, ctx.locale),
                next_action: this.catalog.get("responsibility.next", {}, ctx.locale),
                due_at: new Date(this.clock.now().getTime() + DAY_MS).toISOString(),
            },
            owner,
        )
    }

    /**
     * Opens a follow-up owned by a member on the system's behalf (an automation), unless the customer already has an open one with
     * the same title; answers true when it opened one. The owner is the active member with the name the automation gave, else the
     * workspace owner.
     */
    async openNamed(workspaceId: string, task: NamedFollowUp): Promise<boolean> {
        const open = await this.entityManager.query<Array<ResponsibilityIdRow>>(FIND_OPEN_TITLED_RESPONSIBILITY, [
            workspaceId,
            task.leadId,
            task.title,
        ])
        if (open.length > 0) return false
        const owner =
            (await this.owners.memberNamed(workspaceId, task.ownerName)) ??
            (await this.owners.workspaceOwner(workspaceId))
        await this.insert(
            workspaceId,
            { lead_id: task.leadId, title: task.title, next_action: task.nextAction, due_at: task.dueAt },
            owner,
        )
        return true
    }

    /** The workspace's responsibilities with their customer, open ones first. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<ResponsibilityListing>> {
        await this.members.require(principalId, workspaceId)
        return this.entityManager.query<Array<ResponsibilityListing>>(LIST_RESPONSIBILITIES, [workspaceId])
    }

    /** The steps of a workspace's customer in journey order, after membership is proved by the reader. */
    listForLead(workspaceId: string, leadId: string): Promise<Array<ResponsibilityRecord>> {
        return this.entityManager.query<Array<ResponsibilityRecord>>(LIST_LEAD_RESPONSIBILITIES, [workspaceId, leadId])
    }

    /** The open follow-ups of the workspace, earliest due first, after membership is proved by the reader. */
    listOpen(workspaceId: string): Promise<Array<ResponsibilityRecord>> {
        return this.entityManager.query<Array<ResponsibilityRecord>>(LIST_OPEN_RESPONSIBILITIES, [workspaceId])
    }

    /** The oldest open step of each lead in the current board page, without a workspace-wide history cutoff. */
    listForBoard(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<ResponsibilityRecord>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<ResponsibilityRecord>>(LIST_BOARD_RESPONSIBILITIES, [
            workspaceId,
            leadIds,
        ])
    }

    /** Adds a responsibility and its evidence, inside the caller's transaction when one is supplied. */
    async create(
        principalId: string,
        workspaceId: string,
        input: NewResponsibility,
        manager: EntityManager = this.entityManager,
    ): Promise<ResponsibilityRecord> {
        const member = await this.members.require(principalId, workspaceId)
        const owner = await this.owners.resolve(manager, workspaceId, input.owner)
        const created = await this.insert(workspaceId, input, owner, manager)
        await this.events.record(
            {
                workspaceId,
                kind: "responsibility.assigned",
                actor: member.displayName,
                summary: `${created.owner_name}: ${created.next_action}`,
                leadId: input.lead_id,
            },
            manager,
        )
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
    async find(
        workspaceId: string,
        responsibilityId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalResponsibility> {
        const rows = await manager.query<Array<ResponsibilityRecord>>(FIND_RESPONSIBILITY, [
            workspaceId,
            responsibilityId,
        ])
        return rows[0] ?? null
    }

    /** Moves a responsibility to a status on the engine's behalf; the engine already proved who may act. */
    async setStatus(
        scope: ResponsibilityScope,
        responsibilityId: string,
        status: ResponsibilityStatus,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.query(UPDATE_RESPONSIBILITY_STATUS, [scope.workspaceId, responsibilityId, status])
    }

    /** Sets the next step of a responsibility. */
    async setNextAction(scope: ResponsibilityScope, responsibilityId: string, nextAction: string): Promise<void> {
        await this.entityManager.query(UPDATE_RESPONSIBILITY_NEXT_ACTION, [
            scope.workspaceId,
            responsibilityId,
            nextAction,
        ])
    }

    private async insert(
        workspaceId: string,
        input: Omit<NewResponsibility, "owner">,
        owner: ResolvedOwner,
        manager: EntityManager = this.entityManager,
    ): Promise<ResponsibilityRecord> {
        const row = (
            await manager.query<Array<ResponsibilityRecord>>(INSERT_RESPONSIBILITY, [
                workspaceId,
                input.lead_id,
                input.title,
                owner.kind,
                owner.agentId,
                owner.name,
                input.next_action,
                input.due_at,
                owner.memberId,
            ])
        )[0]
        if (row === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return row
    }
}
