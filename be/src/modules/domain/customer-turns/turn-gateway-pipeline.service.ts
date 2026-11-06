import { Injectable } from "@nestjs/common"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import type { JsonResult, ToolContext } from "@modules/domain/agent-tools"
import { IntentTurnService } from "@modules/domain/agent-turns"
import { toolResultOf } from "@modules/domain/intent-contracts"
import type { GatewayJson } from "@modules/domain/mcp-gateway"
import type { PipelineGate } from "./customer-intent.contracts"

@Injectable()
/**
 * How the connector door of a customer turn treats a turn that runs on the contract pipeline. Only the bridge of a run names a pin
 * (null, or the intent a split turn is pinned to); a per-job token names none, so its turn is never on the pipeline.
 * On the pipeline an unpinned turn never writes: the write waits for the follow-up turn pinned to the intent that owns it. A call's result
 * reaches the model as marked data, never as an instruction.
 */
export class TurnGatewayPipelineService {
    constructor(private readonly intents: IntentTurnService) {}

    /** Whether the turn is on the pipeline, and whether a write must wait for a turn of its own. */
    async gateOf(ctx: ToolContext, conversation: ChatTurnConversation): Promise<PipelineGate> {
        const { pinnedIntent } = ctx
        if (pinnedIntent === undefined) return { on: false, refuses: false }
        const on = await this.intents.pipelineOf({
            workspaceId: ctx.workspaceId,
            agentId: conversation.agent.id,
            source: "customer",
            authorUserId: null,
            pinned: pinnedIntent,
        })
        return { on, refuses: on && pinnedIntent === null }
    }

    /** What a call answers: its result, marked as data on the pipeline. */
    resultOf(gate: PipelineGate, value: GatewayJson): JsonResult {
        return { result: gate.on ? toolResultOf(value) : value }
    }
}
