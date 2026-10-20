import { Injectable } from "@nestjs/common"
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
import type { JsonObject } from "@modules/domain/mcp-gateway"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The arguments a gated call stored, or null when they are not a JSON object. */
export const argsOfField = (value: unknown): JsonObject | null => {
    try {
        const parsed: unknown = JSON.parse(textOf(value))
        return isObject(parsed) ? parsed : null
    } catch {
        return null
    }
}

@Injectable()
/**
 * `gateway_call`: a connector call the MCP gateway held for a person (a discount over the grant's `limit_pct`, a tool in ask mode).
 * Once approved it replays the exact call as approved by that person (audited under their name) and tells the guest the approved
 * outcome in their own conversation; a call the connector refused fails the item, so nothing is claimed.
 */
export class GatewayCallPerformerService implements WorkPerformer {
    constructor(
        private readonly gateway: McpGatewayService,
        private readonly delivery: CustomerDeliveryService,
    ) {}

    /** The proposal is preset by the turn that hit the limit. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Replays the call as approved and answers the guest. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const { fields } = proposal
        const tool = textOf(fields.tool)
        const args = argsOfField(fields.args_json)
        const conversationId = textOf(fields.conversation_id)
        if (tool === "" || args === null || conversationId === "") {
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        }
        const result = await this.gateway.call(
            {
                workspaceId: ctx.workspaceId,
                agentId: textOf(fields.agent_id),
                conversationId,
                workItemId: item.id,
                approvedBy: by.name,
            },
            tool,
            args,
        )
        if (!result.ok) {
            throw new WorkPerformersError({
                code: WorkPerformersErrorCode.ConnectorRefused,
                params: { tool, code: result.code },
            })
        }
        const reply = proposal.draft ?? ""
        // The approved answer leaves once, through the existing approved-reply path (stored with the decider's name, keyed by the item).
        if (reply !== "")
            await this.delivery.approvedInConversation(ctx.workspaceId, conversationId, reply, by.name, item.id)
        return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id, detail: reply || null }
    }
}
