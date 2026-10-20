import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, JsonObject } from "@modules/domain/mcp-gateway"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { FIND_LINKED_CONVERSATION } from "./persistence/early-checkin.sql"

/** The tool that marks the Customer care agent of a workspace. */
const CARE_TOOLS = ["hakuen.keycode.reveal"]

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textAt = (value: JsonObject, key: string): string => {
    const member = value[key]
    return typeof member === "string" ? member : ""
}

const fieldText = (proposal: Proposal, key: string): string => {
    const value = proposal.fields[key]
    return typeof value === "string" ? value : ""
}

/** The room a front-desk line names ("phòng 302", "P.302", "p302"), or null. */
export const roomOfText = (text: string): string | null =>
    /(?:ph[oò]ng|\bp\.?)\s*(\d{2,4}[a-z]?)\b/iu.exec(text)?.[1] ?? null

/** Every text of an item: its summary, its draft and its text fields, where the front desk's words are. */
const wordsOf = (proposal: Proposal): string =>
    [
        proposal.summary,
        proposal.draft ?? "",
        ...Object.values(proposal.fields).map((value) => (typeof value === "string" ? value : "")),
    ].join(" ")

@Injectable()
/**
 * `care_early_checkin`: the front desk asks AI Customer care ("@AI CSKH phòng 302 khách xin nhận sớm"). Preparing reads the stay of the
 * room in HAKUEN (`hakuen.stay.current`) and finds the guest's conversation through NIVO's identity link; the item waits for the front
 * desk's approval. Once approved, `hakuen.stay.checkIn` (early) and `hakuen.keycode.reveal` run through the gateway under the
 * approver's name, and the code goes ONLY to that guest's conversation: NIVO stores the message with the code masked and never keeps it.
 * Whether an early check-in is allowed and its fee are HAKUEN's rules, not NIVO's.
 */
export class EarlyCheckinPerformerService implements WorkPerformer {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        private readonly gateway: McpGatewayService,
        private readonly messages: AgentMessagesService,
        private readonly channels: ChannelDeliveryService,
    ) {}

    /** Reads the room's stay and the guest's conversation; the proposal names them for the front desk to approve. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const room = roomOfText(wordsOf(item.proposal))
        if (room === null) throw this.noStay("")
        const [agentId] = await this.gateway.agentsGranted(ctx.workspaceId, CARE_TOOLS)
        if (agentId === undefined) throw this.noStay(room)
        const current = await this.gateway.call(this.callerOf(ctx, agentId, item, null), "hakuen.stay.current", {
            room,
        })
        const stay = current.ok && isObject(current.value.stay) ? current.value.stay : null
        if (stay === null) throw this.noStay(room)
        const rows: ReadonlyArray<{ readonly id: string }> = await this.entityManager.query(FIND_LINKED_CONVERSATION, [
            ctx.workspaceId,
            textAt(stay, "guestId"),
        ])
        const conversation = rows[0]
        if (conversation === undefined) {
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.GuestUnreachable, params: { room } })
        }
        const guest = textAt(stay, "guestName")
        return {
            proposal: {
                summary: this.text("gatewayTurns.earlySummary", { room, name: guest }),
                fields: {
                    ...item.proposal.fields,
                    room,
                    stay_id: textAt(stay, "stayId"),
                    customer: guest,
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    sources: "HAKUEN stay.current (live)",
                },
            },
        }
    }

    /** Checks in early, reveals the code and sends it to the guest only. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const room = fieldText(proposal, "room")
        const stayId = fieldText(proposal, "stay_id")
        const conversationId = fieldText(proposal, "conversation_id")
        const caller = this.callerOf(ctx, fieldText(proposal, "agent_id"), item, conversationId, by.name)
        const checkedIn = await this.gateway.call(caller, "hakuen.stay.checkIn", {
            stayId,
            earlyAt: this.clock.now().toISOString(),
        })
        if (!checkedIn.ok) throw this.refused("hakuen.stay.checkIn", checkedIn.code)
        const revealed = await this.gateway.call(caller, "hakuen.keycode.reveal", { stayId })
        if (!revealed.ok) throw this.refused("hakuen.keycode.reveal", revealed.code)
        const text = this.text("gatewayTurns.keyMessage", {
            name: fieldText(proposal, "customer"),
            room,
            code: textAt(revealed.value, "code"),
            validUntil: textAt(revealed.value, "validUntil"),
        })
        const messageId = await this.messages.storeAgentMessage(
            ctx.workspaceId,
            conversationId,
            this.text("gatewayTurns.keyStored", { room }),
        )
        await this.channels.deliver({ conversationId, messageId, text })
        return {
            summary: this.text("gatewayTurns.earlyDone", { room }),
            evidence: "captured",
            lead_id: item.lead_id,
            detail: null,
        }
    }

    private callerOf(
        ctx: WorkContext,
        agentId: string,
        item: WorkItem,
        conversationId: string | null,
        approvedBy?: string,
    ): GatewayCaller {
        return {
            workspaceId: ctx.workspaceId,
            agentId,
            conversationId,
            workItemId: item.id,
            ...(approvedBy === undefined ? {} : { approvedBy }),
        }
    }

    private noStay(room: string): WorkPerformersError {
        return new WorkPerformersError({ code: WorkPerformersErrorCode.StayNotFound, params: { room } })
    }

    private refused(tool: string, code: string): WorkPerformersError {
        return new WorkPerformersError({ code: WorkPerformersErrorCode.ConnectorRefused, params: { tool, code } })
    }

    private text(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(key, params, "vi")
    }
}
