import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCaller } from "@modules/domain/mcp-gateway"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { GuestContext, OwnerChoice } from "./gateway-turns.contracts"
import { customerIdOf } from "./gateway-reply.policy"
import { HubNotesService } from "./hub-notes.service"
import { guestContextOf, ownerFor } from "./ownership.policy"
import type { IdRow, NameRow } from "./persistence/gateway-turns.rows"
import { AGENT_NAME, INSERT_OWNERSHIP_EVENT, MOVE_CONVERSATION } from "./persistence/gateway-turns.sql"

const LOCALE = "vi"
/** The connector the hotel desk works against. */
export const HOTEL_CONNECTOR = "hakuen"
/** The tools that mark the Sales agent and the Customer care agent of a workspace. */
const SALES_TOOLS = ["hakuen.booking.hold", "hakuen.spa.hold"]
const CARE_TOOLS = ["hakuen.keycode.reveal"]
/** How long a guest context stays fresh. */
const CONTEXT_TTL_MS = 60_000

/** A cached guest context. */
interface Cached {
    /** The context. */
    readonly context: GuestContext
    /** When it was read. */
    readonly at: number
}

/** The Sales and Customer care agents of a workspace. */
export interface DeskAgents {
    /** The Sales agent, or null. */
    readonly sales: string | null
    /** The Customer care agent, or null. */
    readonly care: string | null
}

@Injectable()
/**
 * The guest context of a hotel conversation before the AI step: who the guest is in HAKUEN and where their stay stands, read through
 * the gateway (cached 60 seconds; a failed read keeps the turn and the owner as they are). It also moves the conversation between
 * AI Sales and AI Customer care by the lifecycle policy, records the move and posts the hand-off note to both agents' rooms.
 */
export class GatewayContextService {
    private readonly cache = new Map<string, Cached>()

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        private readonly gateway: McpGatewayService,
        private readonly notes: HubNotesService,
    ) {}

    /** True when the conversation's agent may use any HAKUEN tool. */
    async servesHotel(conversation: TurnConversation): Promise<boolean> {
        const grants = await this.gateway.grantsOf(conversation.workspaceId, conversation.agent.id)
        return grants.some((grant) => grant.mode !== "never" && grant.tool.startsWith(`${HOTEL_CONNECTOR}.`))
    }

    /** The Sales and Customer care agents of the workspace, by their grants. */
    async deskAgents(workspaceId: string): Promise<DeskAgents> {
        const [sales, care] = await Promise.all([
            this.gateway.agentsGranted(workspaceId, SALES_TOOLS),
            this.gateway.agentsGranted(workspaceId, CARE_TOOLS),
        ])
        return { sales: sales[0] ?? null, care: care[0] ?? null }
    }

    /** The guest context of a Zalo conversation, or null when it cannot be read (or the channel has no identity). */
    async contextOf(conversation: TurnConversation): Promise<GuestContext | null> {
        if (conversation.externalId === null) return null
        const key = `${conversation.workspaceId}:${conversation.id}`
        const now = this.clock.now().getTime()
        const cached = this.cache.get(key)
        if (cached !== undefined && now - cached.at < CONTEXT_TTL_MS) return cached.context
        const caller = this.callerOf(conversation)
        const guest = await this.gateway.call(caller, "hakuen.guest.findByChannelIdentity", {
            channel: conversation.channel,
            externalId: customerIdOf(conversation.externalId),
        })
        if (!guest.ok) return null
        const guestId = guestContextOf(guest.value, null).guestId
        const stay = guestId === null ? null : await this.gateway.call(caller, "hakuen.stay.current", { guestId })
        if (stay !== null && !stay.ok) return null
        const context = guestContextOf(guest.value, stay?.value ?? null)
        this.cache.set(key, { context, at: now })
        return context
    }

    /** The context lines the AI step may use. */
    briefOf(context: GuestContext): ReadonlyArray<string> {
        const lines = [this.text("gatewayTurns.contract")]
        if (context.guestId !== null) {
            lines.push(this.text("gatewayTurns.guestKnown", { name: context.name, tier: context.tier || "-" }))
        }
        if (context.stayId !== null) {
            lines.push(this.text("gatewayTurns.stayKnown", { room: context.room || "-", stage: context.stage.kind }))
        }
        return lines
    }

    /**
     * Moves the conversation to the owner the lifecycle names, unless a person holds it or it already is there; records the move and
     * posts the hand-off note in both agents' rooms. Answers the choice when it moved, else null.
     */
    async route(conversation: TurnConversation, context: GuestContext): Promise<OwnerChoice | null> {
        if (conversation.handledBy !== null) return null
        const choice = ownerFor(context.stage, this.clock.now())
        const agents = await this.deskAgents(conversation.workspaceId)
        const target = choice.role === "care" ? agents.care : agents.sales
        if (target === null || target === conversation.agent.id) return null
        const moved: ReadonlyArray<IdRow> = await this.entityManager.query(MOVE_CONVERSATION, [
            conversation.workspaceId,
            conversation.id,
            target,
        ])
        if (moved.length === 0) return null
        await this.entityManager.query(INSERT_OWNERSHIP_EVENT, [
            conversation.workspaceId,
            conversation.id,
            conversation.agent.id,
            target,
            choice.reason,
            context.stayId,
        ])
        await this.postHandoff(conversation, context, target, choice)
        return choice
    }

    private async postHandoff(
        conversation: TurnConversation,
        context: GuestContext,
        target: string,
        choice: OwnerChoice,
    ): Promise<void> {
        const rows: ReadonlyArray<NameRow> = await this.entityManager.query(AGENT_NAME, [
            conversation.workspaceId,
            target,
        ])
        const toName = rows[0]?.name ?? ""
        const guest = context.name || conversation.visitorName || ""
        const name = context.room === "" ? guest : `${guest} (P.${context.room})`
        const title = this.text("gatewayTurns.cardHandoff", {
            name,
            from: conversation.agent.name,
            to: toName,
            why: this.text(`gatewayTurns.why.${choice.reason}`),
        })
        const refs = { leadId: conversation.leadId, workItemId: null }
        for (const agentId of [conversation.agent.id, target]) {
            await this.notes.post(
                {
                    workspaceId: conversation.workspaceId,
                    room: agentId === target ? "care" : "sales",
                    type: "handoff_note",
                    title,
                    fields: [],
                    authorName: toName,
                },
                agentId,
                refs,
            )
        }
    }

    /** The gateway caller of a conversation's agent. */
    callerOf(conversation: TurnConversation): GatewayCaller {
        return {
            workspaceId: conversation.workspaceId,
            agentId: conversation.agent.id,
            conversationId: conversation.id,
            workItemId: null,
        }
    }

    /** Drops the cached context after the turn changed it (a new guest, a hold). */
    forget(conversation: TurnConversation): void {
        this.cache.delete(`${conversation.workspaceId}:${conversation.id}`)
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(key, params, LOCALE)
    }
}
