import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentHandleCard } from "@modules/domain/agents"
import { CommandBusService, ModuleCatalogService } from "@modules/domain/decisions"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadName } from "@modules/domain/leads"
import { MessagesReadService, OfficeLinesService } from "@modules/domain/messages"
import type { LineText } from "@modules/domain/messages"
import { OrdersService } from "@modules/domain/orders"
import type { OrderRef as StoredOrderRef } from "@modules/domain/orders"
import type { CommandResult, SendCommandInput, WorkContext } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { isManagerRole, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import type { CommandProposalInput } from "@modules/domain/ai-tasks"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    OfficeCommandCandidatesError,
    OfficeCommandCandidatesErrorCode,
} from "./errors/office-command-candidates.error"
import type {
    CandidateView,
    CommandReading,
    ConfirmRequest,
    ConfirmResult,
    LeadRef,
    OrderRef,
    ProposeOutcome,
    ProposeRequest,
    ReferencePool,
    ReadyResolution,
    ReplyOutcome,
} from "./office-command-candidates.contracts"
import { InjectCommandReader } from "./office-command-candidates.decorators"
import { OfficeCommandCandidatesLogEvent } from "./office-command-candidates.log-events"
import type { CommandReader } from "./office-command-candidates.port"
import {
    acceptsText,
    cardRowsOf,
    failureDetail,
    matchLeads,
    matchOrders,
    mentionedHandles,
    needTextOf,
    resolveCandidate,
    subjectRowOf,
} from "./office-command.policy"
import { OfficeCommandCandidateEntity } from "./persistence/entities"

/** Only owners and managers compose commands: the receiver's own gate still decides what happens next. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
/** How many recent customers and orders a message's names are matched against. */
const REF_POOL = 300
/** How many matched customers or orders are offered to the model. */
const MAX_REFS = 5
/** How many candidates the thread shows. */
const CANDIDATE_LIST_LIMIT = 60

const toLeadRef = (row: LeadName): LeadRef => ({ id: row.id, name: row.contactName, company: row.company })
const toOrderRef = (row: StoredOrderRef): OrderRef => ({
    id: row.id,
    orderNo: row.orderNo,
    leadId: row.leadId,
})

/** The columns a candidate card reads, named as the contract names them; the time keeps the text shape the card always had. */
const CANDIDATE_RETURNING =
    "id, message_id, module, command, payload, summary, shown, status, work_item_id, refusal_detail, to_json(created_at) #>> '{}' AS created_at"

/** The most agents a handle lookup can answer (a handle is unique in a workspace). */
const HANDLE_LIMIT = 10

@Injectable()
/**
 * Office "@agent -> command". An owner or manager mentions ONE agent; NIVO reads the message into a command candidate with ONE model
 * call, shows it as a confirm card, and only a click sends it through the command bus as the owner, so the receiver's own gate still
 * decides. The model never talks to another agent: it picks from the receiver's declared commands and fills what the contract requires
 * from the message plus the customer or order the message names. When nothing maps, NIVO answers with what that agent accepts and stops.
 */
export class OfficeCommandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly modules: ModuleCatalogService,
        private readonly lines: OfficeLinesService,
        private readonly bus: CommandBusService,
        @InjectCommandReader() private readonly reader: CommandReader,
        private readonly events: EventsService,
        private readonly messages: MessagesReadService,
        private readonly agents: AgentDirectoryService,
        private readonly leads: LeadReadService,
        private readonly orders: OrdersService,
    ) {}

    /**
     * Reads an owner's Office message into a command card or a NIVO reply. `chat` means the message is not for a command (no single
     * mention, an agent that accepts nothing, or a question) and the caller answers it as a chat. Asking again for the same message
     * answers its existing card without a second model call.
     */
    async propose(principalId: string, workspaceId: string, request: ProposeRequest): Promise<ProposeOutcome> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const message = await this.messageOf(workspaceId, request.messageId)
        const existing = await this.candidateOfMessage(workspaceId, message.id)
        if (existing !== undefined) return { kind: "card", candidate: existing }
        const agent = await this.mentionedAgent(workspaceId, message.body)
        if (agent === undefined) return { kind: "chat" }
        const accepts = await this.modules.acceptsOf(agent.module)
        if (accepts.length === 0) return { kind: "chat" }

        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: request.locale }
        const pool = await this.referencesIn(workspaceId, message.body)
        const names = {
            handle: agent.handle,
            agent: await this.modules.nameOf(agent.module, request.locale),
            list: acceptsText(request.locale, accepts),
        }
        const reading = await this.read(workspaceId, request.locale, {
            agentName: names.agent,
            options: accepts,
            customers: pool.refs.leads.map((lead) => ({ id: lead.id, name: lead.name })),
            orders: pool.refs.orders.map((order) => ({ id: order.id, order_no: order.orderNo, lead_id: order.leadId })),
            text: message.body,
        })
        if (!reading.ok) return this.reply(ctx, "office.cmdReadFailed", { ...names, error: reading.error })
        if (reading.choice.intent === "question") return { kind: "chat" }

        const resolution = resolveCandidate(reading.choice, accepts, pool.refs)
        if (resolution.kind === "unmapped") return this.reply(ctx, "office.cmdUnmapped", names)
        if (resolution.kind === "missing") {
            const missing = resolution.missing
                .map((key) => {
                    const need = needTextOf(key, resolution.subjectType)
                    return this.catalog.get(need.key, { field: need.field }, request.locale)
                })
                .join(", ")
            return this.reply(ctx, "office.cmdMissing", {
                handle: names.handle,
                what: resolution.description[request.locale],
                missing,
            })
        }
        const candidate = await this.createCandidate(member, message.id, agent.module, resolution, pool, request.locale)
        await this.recordEvidence(ctx, agent.module, resolution.command, message.id)
        return { kind: "card", candidate }
    }

    /** The latest command candidates of the workspace, newest first; staff see none, as before. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<CandidateView>> {
        const member = await this.members.require(principalId, workspaceId)
        if (!isManagerRole(member.role)) return []
        return this.candidatesOf(this.entityManager)
            .where("c.workspaceId = :workspaceId", { workspaceId })
            .orderBy("c.createdAt", "DESC")
            .addOrderBy("c.id", "DESC")
            .limit(CANDIDATE_LIST_LIMIT)
            .getRawMany<CandidateView>()
    }

    /**
     * Sends a pending candidate through the command bus as the owner. The claim (pending to sent in one statement) makes a double
     * click send once; a refusal puts the card back to pending with the reason. Confirming a candidate that was already sent answers
     * where it went.
     */
    async confirm(principalId: string, workspaceId: string, request: ConfirmRequest): Promise<ConfirmResult> {
        const member = await this.members.require(principalId, workspaceId, MANAGERS)
        const claim = await this.entityManager
            .createQueryBuilder(OfficeCommandCandidateEntity, "o")
            .update()
            .set({ status: "sent", decidedAt: () => "now()", refusalDetail: null })
            .where("workspace_id = :workspaceId AND id = :candidateId AND status = 'pending'", {
                workspaceId,
                candidateId: request.candidateId,
            })
            .returning(CANDIDATE_RETURNING)
            .execute()
        const [claimed] = claim.raw as Array<CandidateView>
        if (claimed === undefined) return this.alreadyHandled(workspaceId, request.candidateId)
        if ((await this.modules.entryOf(claimed.module)) === null) {
            await this.release(workspaceId, claimed.id, `no agent ${claimed.module}`)
            throw new OfficeCommandCandidatesError({
                code: OfficeCommandCandidatesErrorCode.ModuleUnknown,
                params: { module: claimed.module },
            })
        }
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: request.locale }
        const result = await this.send(ctx, claimed, {
            from: "owner",
            to: claimed.module,
            command: claimed.command,
            payload: claimed.payload,
            reason: `office:${claimed.message_id}`,
        })
        if (!result.ok) {
            await this.release(workspaceId, claimed.id, result.detail)
            throw new OfficeCommandCandidatesError({
                code: OfficeCommandCandidatesErrorCode.CommandRefused,
                params: { detail: result.detail },
            })
        }
        await this.entityManager.update(
            OfficeCommandCandidateEntity,
            { workspaceId, id: claimed.id },
            { workItemId: result.item.id },
        )
        return { workItemId: result.item.id, module: claimed.module, created: result.created }
    }

    /** Cancels a pending candidate; nothing is sent. Cancelling a cancelled candidate again is a no-op. */
    async cancel(principalId: string, workspaceId: string, candidateId: string): Promise<void> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        const cancelled = await this.entityManager
            .createQueryBuilder(OfficeCommandCandidateEntity, "o")
            .update()
            .set({ status: "cancelled", decidedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :candidateId AND status = 'pending'", {
                workspaceId,
                candidateId,
            })
            .returning("id")
            .execute()
        if ((cancelled.raw as Array<{ id: string }>).length > 0) return
        const row = await this.candidateOf(workspaceId, candidateId)
        if (row === undefined)
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateNotFound })
        if (row.status === "sent")
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateSent })
    }

    /** The candidates of the manager, read with the columns and the time text the contract names. */
    private candidatesOf(manager: EntityManager): SelectQueryBuilder<OfficeCommandCandidateEntity> {
        return manager
            .createQueryBuilder(OfficeCommandCandidateEntity, "c")
            .select("c.id", "id")
            .addSelect("c.messageId", "message_id")
            .addSelect("c.module", "module")
            .addSelect("c.command", "command")
            .addSelect("c.payload", "payload")
            .addSelect("c.summary", "summary")
            .addSelect("c.shown", "shown")
            .addSelect("c.status", "status")
            .addSelect("c.workItemId", "work_item_id")
            .addSelect("c.refusalDetail", "refusal_detail")
            .addSelect("to_json(c.created_at) #>> '{}'", "created_at")
    }

    private candidateOf(workspaceId: string, candidateId: string): Promise<CandidateView | undefined> {
        return this.candidatesOf(this.entityManager)
            .where("c.workspaceId = :workspaceId AND c.id = :candidateId", { workspaceId, candidateId })
            .limit(1)
            .getRawOne<CandidateView>()
    }

    private async messageOf(workspaceId: string, messageId: string): Promise<LineText> {
        const message = await this.messages.textOf(workspaceId, messageId)
        if (message === undefined)
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.MessageNotFound })
        if (message.author_kind !== "human")
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.MessageNotHuman })
        return message
    }

    private async candidateOfMessage(workspaceId: string, messageId: string): Promise<CandidateView | undefined> {
        return this.candidatesOf(this.entityManager)
            .where("c.workspaceId = :workspaceId AND c.messageId = :messageId", { workspaceId, messageId })
            .limit(1)
            .getRawOne<CandidateView>()
    }

    /** The one active agent the message mentions; none when it mentions no agent, several, or a handle nobody has. */
    private async mentionedAgent(workspaceId: string, body: string): Promise<AgentHandleCard | undefined> {
        const handles = mentionedHandles(body)
        if (handles.length !== 1) return undefined
        const agents = await this.agents.activeByHandles(workspaceId, handles, HANDLE_LIMIT)
        return agents.length === 1 ? agents[0] : undefined
    }

    /** Names and numbers the message could mean: matched deterministically against the workspace's recent customers and orders. */
    private async referencesIn(workspaceId: string, body: string): Promise<ReferencePool> {
        const [leadRows, orderRows] = await Promise.all([
            this.leads.recentNames(workspaceId, REF_POOL),
            this.orders.recentRefs(workspaceId, REF_POOL),
        ])
        const leads = leadRows.map(toLeadRef)
        return {
            refs: {
                leads: matchLeads(body, leads).slice(0, MAX_REFS),
                orders: matchOrders(body, orderRows.map(toOrderRef)).slice(0, MAX_REFS),
            },
            leadNames: new Map(leads.map((lead) => [lead.id, lead.name])),
        }
    }

    /** The ONE model call of this feature; its failure becomes a reply, never an error. */
    private async read(workspaceId: string, locale: Locale, input: CommandProposalInput): Promise<CommandReading> {
        try {
            return { ok: true, choice: await this.reader.proposeCommands({ workspaceId, locale }, input) }
        } catch (cause) {
            this.logger.error(OfficeCommandCandidatesLogEvent.CommandReadFailed, cause, { workspaceId })
            return { ok: false, error: failureDetail(cause) }
        }
    }

    private async reply(
        ctx: WorkContext,
        key: string,
        params: Readonly<Record<string, string>>,
    ): Promise<ReplyOutcome> {
        const body = this.catalog.get(key, params, ctx.locale)
        await this.lines.post(ctx, { body, lead_id: null, work_item_id: null })
        return { kind: "reply", body }
    }

    private async createCandidate(
        member: WorkspaceMember,
        messageId: string,
        module: string,
        ready: ReadyResolution,
        pool: ReferencePool,
        locale: Locale,
    ): Promise<CandidateView> {
        const rows = cardRowsOf(ready, pool.refs, pool.leadNames, {
            customer: this.catalog.get("office.cmdFieldCustomer", {}, locale),
            order: this.catalog.get("office.cmdFieldOrder", {}, locale),
        })
        const what = ready.description[locale]
        const subject = subjectRowOf(rows)
        const summary =
            subject === undefined ? what : this.catalog.get("office.cmdFor", { what, subject: subject.value }, locale)
        const created = await this.entityManager
            .createQueryBuilder(OfficeCommandCandidateEntity, "o")
            .insert()
            .values({
                workspaceId: member.workspaceId,
                messageId,
                module,
                command: ready.command,
                payload: { ...ready.payload },
                summary,
                shown: [...rows],
                createdBy: member.displayName,
            })
            .orUpdate(["message_id"], ["message_id"])
            .returning(CANDIDATE_RETURNING)
            .execute()
        const [candidate] = created.raw as Array<CandidateView>
        return candidate ?? this.missingCandidate()
    }

    private missingCandidate(): never {
        throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateNotFound })
    }

    private async recordEvidence(ctx: WorkContext, module: string, command: string, messageId: string): Promise<void> {
        try {
            await this.events.record({
                workspaceId: ctx.workspaceId,
                kind: "command.candidate",
                actor: ctx.actor,
                summary: `owner -> ${module}.${command}`,
                evidence: messageId,
            })
        } catch (cause) {
            this.logger.error(OfficeCommandCandidatesLogEvent.EvidenceFailed, cause, { workspaceId: ctx.workspaceId })
        }
    }

    /** A candidate somebody else already claimed: where it went, or why it did not. */
    private async alreadyHandled(workspaceId: string, candidateId: string): Promise<ConfirmResult> {
        const row = await this.candidateOf(workspaceId, candidateId)
        if (row === undefined)
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateNotFound })
        if (row.status === "cancelled")
            throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateCancelled })
        if (row.status === "sent" && row.work_item_id !== null) {
            return { workItemId: row.work_item_id, module: row.module, created: false }
        }
        throw new OfficeCommandCandidatesError({ code: OfficeCommandCandidatesErrorCode.CandidateInProgress })
    }

    private async send(ctx: WorkContext, claimed: CandidateView, input: SendCommandInput): Promise<CommandResult> {
        try {
            return await this.bus.sendCommand(ctx, input)
        } catch (cause) {
            await this.release(ctx.workspaceId, claimed.id, failureDetail(cause))
            throw cause
        }
    }

    private async release(workspaceId: string, candidateId: string, detail: string): Promise<void> {
        await this.entityManager.update(
            OfficeCommandCandidateEntity,
            { workspaceId, id: candidateId },
            { status: "pending", decidedAt: null, refusalDetail: detail },
        )
    }
}
