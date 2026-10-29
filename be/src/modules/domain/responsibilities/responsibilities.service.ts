import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { Locale, MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { ResponsibilityEntity } from "./persistence/entities"
import type {
    AddResponsibilityParams,
    AssignResponsibilityParams,
    HandToAccountingParams,
    ResponsibilityResult,
} from "./responsibilities.contracts"
import type { OwnerAgent } from "./responsibility-owner.policy"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"

/** The evidence-log kind of a new owner. */
const ASSIGNED_KIND = "responsibility.assigned"
/** The actor shown for the hand-over a won deal triggers. */
const SALES_AGENT_ACTOR = "Sales Agent"
/** A hand-over to Accounting is due one day later. */
const DAY_MS = 86_400_000

/** A step as the writes answer it, its due date as ISO text. */
interface StepRow {
    readonly id: string
    readonly lead_id: string
    readonly title: string
    readonly owner_kind: string
    readonly owner_agent_id: string | null
    readonly owner_member_id: string | null
    readonly owner_name: string
    readonly next_action: string
    readonly due_at: string | null
    readonly status: string
}
/** The columns of a step the insert writes. */
type NewStep = Pick<
    ResponsibilityEntity,
    | "workspaceId"
    | "leadId"
    | "title"
    | "ownerKind"
    | "ownerAgentId"
    | "ownerName"
    | "nextAction"
    | "dueAt"
    | "ownerMemberId"
>

/** The columns a write answers, the due date as the ISO text of a UTC instant the contract always carried. */
const STEP_RETURNING =
    "id, lead_id, title, owner_kind, owner_agent_id, owner_member_id, owner_name, next_action, status, " +
    "to_char(due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS due_at"

const toResult = (row: StepRow): ResponsibilityResult => ({
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    ownerKind: row.owner_kind,
    ownerAgentId: row.owner_agent_id,
    ownerMemberId: row.owner_member_id,
    ownerName: row.owner_name,
    nextAction: row.next_action,
    dueAt: row.due_at,
    status: row.status,
})

@Injectable()
/** The steps of a lead journey reached only through the shared primary EntityManager. */
export class ResponsibilitiesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly owners: ResponsibilityOwnersService,
    ) {}

    /** Adds the next responsibility of a lead (keeps the loop going after an outcome) and logs who owns it. */
    async addResponsibility(params: AddResponsibilityParams): Promise<ResponsibilityResult> {
        const member = await this.members.require(params.userId, params.workspaceId)
        return this.entityManager.transaction(async (tx) => {
            const owner = await this.owners.resolve(tx, params.workspaceId, params.owner)
            const row = await this.insertForLead(tx, {
                workspaceId: params.workspaceId,
                leadId: params.leadId,
                title: params.title,
                ownerKind: owner.kind,
                ownerAgentId: owner.agentId,
                ownerName: owner.name,
                nextAction: params.nextAction,
                dueAt: params.dueAt === null ? null : new Date(params.dueAt),
                ownerMemberId: owner.memberId,
            })
            if (row === undefined) {
                throw new ResponsibilitiesError({
                    code: ResponsibilitiesErrorCode.LeadNotFound,
                    params: { id: params.leadId },
                })
            }
            await this.logOwner(tx, params.workspaceId, row, member, this.requestLocale.of(params.acceptLanguage))
            return toResult(row)
        })
    }

    /** Changes the owner, next action and due date of a responsibility (and its title when given) and logs who owns it now. */
    async assignResponsibility(params: AssignResponsibilityParams): Promise<ResponsibilityResult> {
        const member = await this.members.require(params.userId, params.workspaceId)
        return this.entityManager.transaction(async (tx) => {
            const owner = await this.owners.resolve(tx, params.workspaceId, params.owner)
            const updated = await tx
                .createQueryBuilder(ResponsibilityEntity, "r")
                .update()
                .set({
                    ownerKind: owner.kind,
                    ownerAgentId: owner.agentId,
                    ownerName: owner.name,
                    nextAction: params.nextAction,
                    dueAt: params.dueAt === null ? null : new Date(params.dueAt),
                    ownerMemberId: owner.memberId,
                    ...(params.title === null ? {} : { title: params.title }),
                })
                .where({ workspaceId: params.workspaceId, id: params.responsibilityId })
                .returning(STEP_RETURNING)
                .execute()
            const [row]: Array<StepRow> = updated.raw
            if (row === undefined) {
                throw new ResponsibilitiesError({
                    code: ResponsibilitiesErrorCode.NotFound,
                    params: { id: params.responsibilityId },
                })
            }
            await this.logOwner(tx, params.workspaceId, row, member, this.requestLocale.of(params.acceptLanguage))
            return toResult(row)
        })
    }

    /**
     * Hands a won deal to the workspace Accounting agent as the next responsibility, due one day later, inside the caller
     * transaction. Answers false, and writes nothing, when the workspace has no active Accounting agent.
     */
    async handToAccounting(params: HandToAccountingParams): Promise<boolean> {
        const { manager, locale } = params
        const agent = await manager
            .createQueryBuilder()
            .select("a.id", "id")
            .addSelect("a.name", "name")
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.module = 'accounting' AND a.status = 'active'", {
                workspaceId: params.workspaceId,
            })
            .orderBy("a.created_at")
            .limit(1)
            .getRawOne<OwnerAgent>()
        if (agent === undefined) return false
        await this.insertForLead(manager, {
            workspaceId: params.workspaceId,
            leadId: params.leadId,
            title: this.messages.get("responsibilities.invoice-title", { name: params.contactName }, locale),
            ownerKind: "agent",
            ownerAgentId: agent.id,
            ownerName: agent.name,
            nextAction: this.messages.get("responsibilities.invoice-next", {}, locale),
            dueAt: new Date(this.clock.now().getTime() + DAY_MS),
            ownerMemberId: null,
        })
        await this.events.record(
            {
                workspaceId: params.workspaceId,
                leadId: params.leadId,
                kind: ASSIGNED_KIND,
                actor: SALES_AGENT_ACTOR,
                summary: this.messages.get("responsibilities.handed-event", { agent: agent.name }, locale),
            },
            manager,
        )
        return true
    }

    /**
     * Writes one open step of a lead of the workspace and answers it, or answers undefined when the workspace has no such lead:
     * the lead row is held `FOR SHARE` in the caller's transaction so it cannot go away between the check and the insert.
     */
    private async insertForLead(manager: EntityManager, step: NewStep): Promise<StepRow | undefined> {
        const lead = await manager
            .createQueryBuilder()
            .select("l.id", "id")
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId AND l.id = :leadId", {
                workspaceId: step.workspaceId,
                leadId: step.leadId,
            })
            .limit(1)
            .setLock("pessimistic_read")
            .getRawOne<{ id: string }>()
        if (lead === undefined) return undefined
        const inserted = await manager
            .createQueryBuilder(ResponsibilityEntity, "r")
            .insert()
            .values(step)
            .returning(STEP_RETURNING)
            .execute()
        const [row]: [StepRow] = inserted.raw
        return row
    }

    private logOwner(
        tx: EntityManager,
        workspaceId: string,
        row: StepRow,
        actor: WorkspaceMember,
        locale: Locale,
    ): Promise<void> {
        return this.events.record(
            {
                workspaceId,
                leadId: row.lead_id,
                kind: ASSIGNED_KIND,
                actor: actor.displayName,
                summary: this.messages.get(
                    "responsibilities.owner-next",
                    { owner: row.owner_name, next: row.next_action },
                    locale,
                ),
            },
            tx,
        )
    }
}
