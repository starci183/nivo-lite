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
import type { AgentsRow, ResponsibilitiesRow } from "./persistence/responsibilities.rows"
import {
    FIND_ACCOUNTING_AGENT,
    FIND_AGENT,
    INSERT_RESPONSIBILITY,
    UPDATE_RESPONSIBILITY,
} from "./persistence/responsibilities.sql"
import type {
    AddResponsibilityParams,
    AssignResponsibilityParams,
    HandToAccountingParams,
    ResponsibilityResult,
} from "./responsibilities.contracts"
import { agentToLookUp, resolveOwner } from "./responsibility-owner.policy"
import type { ResolvedOwner } from "./responsibility-owner.policy"

/** The evidence-log kind of a new owner. */
const ASSIGNED_KIND = "responsibility.assigned"
/** The actor shown for the hand-over a won deal triggers. */
const SALES_AGENT_ACTOR = "Sales Agent"
/** A hand-over to Accounting is due one day later. */
const DAY_MS = 86_400_000

type StepRow = Pick<
    ResponsibilitiesRow,
    "id" | "lead_id" | "title" | "owner_kind" | "owner_agent_id" | "owner_name" | "next_action" | "due_at" | "status"
>
interface StepColumns {
    readonly nextAction: string
    readonly dueAt: string | null
}
type OwnerAgentRow = Pick<AgentsRow, "id" | "name">

/** The owner, next action and due date columns a write binds, in the order both statements take them. */
const ownerColumns = (owner: ResolvedOwner, step: StepColumns): ReadonlyArray<string | null> => [
    owner.kind,
    owner.agentId,
    owner.name,
    step.nextAction,
    step.dueAt,
]

const toResult = (row: StepRow): ResponsibilityResult => ({
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    ownerKind: row.owner_kind,
    ownerAgentId: row.owner_agent_id,
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
    ) {}

    /** Adds the next responsibility of a lead (keeps the loop going after an outcome) and logs who owns it. */
    async addResponsibility(params: AddResponsibilityParams): Promise<ResponsibilityResult> {
        const member = await this.members.require(params.userId, params.workspaceId)
        return this.entityManager.transaction(async (tx) => {
            const owner = await this.ownerOf(tx, params.workspaceId, params.owner, member)
            const [row] = await tx.query<Array<StepRow>>(INSERT_RESPONSIBILITY, [
                params.workspaceId,
                params.leadId,
                params.title,
                ...ownerColumns(owner, params),
            ])
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
            const owner = await this.ownerOf(tx, params.workspaceId, params.owner, member)
            const [row] = await tx.query<Array<StepRow>>(UPDATE_RESPONSIBILITY, [
                params.workspaceId,
                params.responsibilityId,
                ...ownerColumns(owner, params),
                params.title,
            ])
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
        const [agent] = await manager.query<Array<OwnerAgentRow>>(FIND_ACCOUNTING_AGENT, [params.workspaceId])
        if (agent === undefined) return false
        await manager.query(INSERT_RESPONSIBILITY, [
            params.workspaceId,
            params.leadId,
            this.messages.get("responsibilities.invoice-title", { name: params.contactName }, locale),
            "agent",
            agent.id,
            agent.name,
            this.messages.get("responsibilities.invoice-next", {}, locale),
            new Date(this.clock.now().getTime() + DAY_MS).toISOString(),
        ])
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

    private async ownerOf(
        tx: EntityManager,
        workspaceId: string,
        owner: string,
        actor: WorkspaceMember,
    ): Promise<ResolvedOwner> {
        const agentId = agentToLookUp(owner)
        const [agent] = agentId === null ? [] : await tx.query<Array<OwnerAgentRow>>(FIND_AGENT, [workspaceId, agentId])
        const verdict = resolveOwner(owner, agent, actor.displayName)
        if (verdict.kind === "refused") {
            throw new ResponsibilitiesError({ code: verdict.code, params: verdict.params })
        }
        return verdict.value
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
