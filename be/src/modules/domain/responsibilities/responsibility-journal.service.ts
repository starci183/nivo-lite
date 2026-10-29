import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
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
import { InjectLeadDesk } from "./responsibilities.decorators"
import type { LeadDesk } from "./responsibilities.ports"
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
import { ResponsibilityEntity } from "./persistence/entities"

const DAY_MS = 86_400_000
const LISTING_LIMIT = 200
const LEAD_STEPS_LIMIT = 200
const OPEN_STEPS_LIMIT = 500
const BOARD_STEPS_LIMIT = 100

/** The columns of a step as the contract carries them, the instants as the JSON text of the stored value. */
const RECORD_RETURNING =
    "id, workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_member_id, owner_name, next_action, " +
    "to_json(due_at) #>> '{}' AS due_at, status, to_json(created_at) #>> '{}' AS created_at"

/** Selects the step columns of the contract from `ResponsibilityEntity` aliased `r`. */
const recordOf = (manager: EntityManager): SelectQueryBuilder<ResponsibilityEntity> =>
    manager
        .createQueryBuilder(ResponsibilityEntity, "r")
        .select("r.id", "id")
        .addSelect("r.workspace_id", "workspace_id")
        .addSelect("r.lead_id", "lead_id")
        .addSelect("r.title", "title")
        .addSelect("r.owner_kind", "owner_kind")
        .addSelect("r.owner_agent_id", "owner_agent_id")
        .addSelect("r.owner_member_id", "owner_member_id")
        .addSelect("r.owner_name", "owner_name")
        .addSelect("r.next_action", "next_action")
        .addSelect("to_json(r.due_at) #>> '{}'", "due_at")
        .addSelect("r.status", "status")
        .addSelect("to_json(r.created_at) #>> '{}'", "created_at")

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
        @InjectLeadDesk() private readonly leadDesk: LeadDesk,
    ) {}

    /**
     * The customer's open responsibility, created when there is none: owned by the workspace's Sales agent, or by the workspace
     * owner (a concrete member) when there is no agent, due in a day.
     */
    async ensureFor(ctx: ResponsibilityScope, leadId: string): Promise<ResponsibilityRecord> {
        const open = await recordOf(this.entityManager)
            .where("r.workspaceId = :workspaceId AND r.leadId = :leadId AND r.status <> 'done'", {
                workspaceId: ctx.workspaceId,
                leadId,
            })
            .orderBy("r.createdAt", "DESC")
            .addOrderBy("r.id", "DESC")
            .limit(1)
            .getRawOne<ResponsibilityRecord>()
        if (open !== undefined) return open
        const [lead] = await this.leadDesk.cardsOf(ctx.workspaceId, [leadId])
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
                title: this.catalog.get("responsibility.title", { name: lead.contactName }, ctx.locale),
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
        const open = await this.entityManager.exists(ResponsibilityEntity, {
            where: { workspaceId, leadId: task.leadId, title: task.title, status: Not("done") },
        })
        if (open) return false
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
        const steps = await recordOf(this.entityManager)
            .where("r.workspaceId = :workspaceId", { workspaceId })
            .orderBy("(r.status = 'done')", "ASC")
            .addOrderBy("r.createdAt", "DESC")
            .addOrderBy("r.id", "DESC")
            .limit(LISTING_LIMIT)
            .getRawMany<ResponsibilityRecord>()
        const leads = new Map(
            (await this.leadDesk.cardsOf(workspaceId, [...new Set(steps.map((step) => step.lead_id))])).map((card) => [
                card.id,
                card,
            ]),
        )
        return steps.flatMap((step): Array<ResponsibilityListing> => {
            const lead = leads.get(step.lead_id)
            if (lead === undefined) return []
            return [{ ...step, contact_name: lead.contactName, company: lead.company, leadStage: lead.stage }]
        })
    }

    /** The steps of a workspace's customer in journey order, after membership is proved by the reader. */
    listForLead(workspaceId: string, leadId: string): Promise<Array<ResponsibilityRecord>> {
        return recordOf(this.entityManager)
            .where("r.workspaceId = :workspaceId AND r.leadId = :leadId", { workspaceId, leadId })
            .orderBy("r.createdAt", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(LEAD_STEPS_LIMIT)
            .getRawMany<ResponsibilityRecord>()
    }

    /** The open follow-ups of the workspace, earliest due first, after membership is proved by the reader. */
    listOpen(workspaceId: string): Promise<Array<ResponsibilityRecord>> {
        return recordOf(this.entityManager)
            .where("r.workspaceId = :workspaceId AND r.status <> 'done'", { workspaceId })
            .orderBy("r.dueAt", "ASC", "NULLS LAST")
            .addOrderBy("r.createdAt", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(OPEN_STEPS_LIMIT)
            .getRawMany<ResponsibilityRecord>()
    }

    /** The oldest open step of each lead in the current board page, without a workspace-wide history cutoff. */
    listForBoard(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<ResponsibilityRecord>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return recordOf(this.entityManager)
            .distinctOn(["r.lead_id"])
            .where("r.workspaceId = :workspaceId AND r.leadId = ANY(:leadIds::uuid[]) AND r.status <> 'done'", {
                workspaceId,
                leadIds,
            })
            .orderBy("r.lead_id")
            .addOrderBy("r.createdAt", "ASC")
            .addOrderBy("r.id", "ASC")
            .limit(BOARD_STEPS_LIMIT)
            .getRawMany<ResponsibilityRecord>()
    }

    /** Adds a responsibility and its evidence, inside the caller's transaction when one is supplied. */
    async create(
        principalId: string,
        workspaceId: string,
        input: NewResponsibility,
        manager: EntityManager = this.entityManager,
    ): Promise<ResponsibilityRecord> {
        const member = await this.members.require(principalId, workspaceId)
        const owner = await this.owners.resolve(workspaceId, input.owner)
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
        const updated = await this.entityManager
            .createQueryBuilder(ResponsibilityEntity, "r")
            .update()
            .set({ status })
            .where({ workspaceId, id: responsibilityId })
            .returning(RECORD_RETURNING)
            .execute()
        const [row]: Array<ResponsibilityRecord> = updated.raw
        if (row === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return row
    }

    /** Marks one of the workspace's responsibilities as waiting for the owner's approval; the card is open. */
    async markWaitingApproval(scope: ResponsibilityScope, responsibilityId: string): Promise<void> {
        await this.entityManager.update(
            ResponsibilityEntity,
            { workspaceId: scope.workspaceId, id: responsibilityId },
            { status: "waiting_approval" },
        )
    }

    /** One responsibility of the workspace, or null when there is none with that id. */
    async find(
        workspaceId: string,
        responsibilityId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalResponsibility> {
        const row = await recordOf(manager)
            .where("r.workspaceId = :workspaceId AND r.id = :responsibilityId", { workspaceId, responsibilityId })
            .limit(1)
            .getRawOne<ResponsibilityRecord>()
        return row ?? null
    }

    /** Moves a responsibility to a status on the engine's behalf; the engine already proved who may act. */
    async setStatus(
        scope: ResponsibilityScope,
        responsibilityId: string,
        status: ResponsibilityStatus,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.update(ResponsibilityEntity, { workspaceId: scope.workspaceId, id: responsibilityId }, { status })
    }

    /** Sets the next step of a responsibility. */
    async setNextAction(scope: ResponsibilityScope, responsibilityId: string, nextAction: string): Promise<void> {
        await this.entityManager.update(
            ResponsibilityEntity,
            { workspaceId: scope.workspaceId, id: responsibilityId },
            { nextAction },
        )
    }

    private async insert(
        workspaceId: string,
        input: Omit<NewResponsibility, "owner">,
        owner: ResolvedOwner,
        manager: EntityManager = this.entityManager,
    ): Promise<ResponsibilityRecord> {
        const row = await (manager.queryRunner?.isTransactionActive === true
            ? this.insertForLead(manager, workspaceId, input, owner)
            : manager.transaction((tx) => this.insertForLead(tx, workspaceId, input, owner)))
        if (row === undefined) throw new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.NotFound })
        return row
    }

    /**
     * Inserts the step for a customer of the workspace and answers it, or answers undefined when the customer is not in it: the
     * customer row is held `FOR SHARE` in the same transaction, so it cannot go away between the check and the insert.
     */
    private async insertForLead(
        tx: EntityManager,
        workspaceId: string,
        input: Omit<NewResponsibility, "owner">,
        owner: ResolvedOwner,
    ): Promise<ResponsibilityRecord | undefined> {
        if (!(await this.leadDesk.hold(workspaceId, input.lead_id, tx))) return undefined
        const inserted = await tx
            .createQueryBuilder(ResponsibilityEntity, "r")
            .insert()
            .values({
                workspaceId,
                leadId: input.lead_id,
                title: input.title,
                ownerKind: owner.kind,
                ownerAgentId: owner.agentId,
                ownerMemberId: owner.memberId,
                ownerName: owner.name,
                nextAction: input.next_action,
                dueAt: input.due_at === null ? null : new Date(input.due_at),
            })
            .returning(RECORD_RETURNING)
            .execute()
        const [row]: [ResponsibilityRecord] = inserted.raw
        return row
    }
}
