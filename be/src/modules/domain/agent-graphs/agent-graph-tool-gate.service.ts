import { Injectable } from "@nestjs/common"
import { GATEWAY_CALL_ACTION, TOOL_CONNECTOR_FACT, TOOL_NAME_FACT } from "@modules/domain/authority-rules"
import type { ToolGraphCall, ToolGraphGate, ToolGraphVerdict } from "@modules/domain/mcp-gateway"
import { AgentGraphChecksService } from "./agent-graph-checks.service"
import { AgentGraphsService } from "./agent-graphs.service"

const RUN: ToolGraphVerdict = { kind: "run" }

/** The subject of a call that serves no conversation. */
const TOOL_SUBJECT = "tool"
const CONVERSATION_SUBJECT = "conversation"

@Injectable()
/**
 * Judges a write tool by the graph of the agent, in the gateway every caller passes. Only a decide point on `gateway_call` judges a
 * call: the seeded approval of that action is the step a held call takes after its grant. With none the grant decides, and the run is
 * recorded. A branch that leads to another action stops the call, because a tool has no work item to hand on.
 */
export class AgentGraphToolGateService implements ToolGraphGate {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly checks: AgentGraphChecksService,
    ) {}

    /** What the graph says about one write call. */
    async judge(call: ToolGraphCall): Promise<ToolGraphVerdict> {
        const state = await this.graphs.stateOfAgent(call.workspaceId, call.agentId)
        if (state === null) return RUN
        const answer = await this.checks.check({
            workspaceId: call.workspaceId,
            installationId: state.installationId,
            action: GATEWAY_CALL_ACTION,
            road: "tool",
            key: `${call.agentId}:${call.key}:${call.name}`,
            subjectType: call.conversationId === null ? TOOL_SUBJECT : CONVERSATION_SUBJECT,
            subjectId: call.conversationId,
            leadId: null,
            text: null,
            money: null,
            attributes: { [TOOL_NAME_FACT]: call.name, [TOOL_CONNECTOR_FACT]: call.name.split(".", 1).join("") },
            turnId: call.turnId,
            wakeId: null,
            askOpensWork: call.conversationId !== null,
        })
        if (answer.outcome === "run") return RUN
        return answer.outcome === "ask" ? { kind: "ask" } : { kind: "stop" }
    }
}
