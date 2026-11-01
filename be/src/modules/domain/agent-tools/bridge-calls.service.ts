import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import type { BridgeTurn, JsonResult, ToolArgs } from "./agent-tools.contracts"
import { InjectBridgeTurns, InjectInternalTools } from "./agent-tools.decorators"
import type { BridgeTurns, InternalTools } from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"
import { isGatewayTool } from "./tool-manifest.policy"
import type { ToolName } from "./tool-manifest.policy"

/** Who the evidence lines of a bridge call name as the actor. */
const ACTOR = "NIVO engine"

@Injectable()
/**
 * The calls of the OpenClaw bridge plugin. A call is for the one turn that is running on the session the plugin names, found by the
 * agent turns from the database: a call with no running turn is refused before any tool runs. A turn with a conversation then runs as a
 * customer turn does; a turn without one (a tag, an event, a clock) only reaches the connector tools, as its own agent.
 */
export class BridgeCallsService {
    constructor(
        @InjectBridgeTurns() private readonly bridge: BridgeTurns,
        @InjectInternalTools() private readonly internal: InternalTools,
        private readonly events: EventsService,
    ) {}

    /** The running turn a bridge credential names; a refused credential or a session with no running turn is a refused token. */
    async admit(token: string): Promise<BridgeTurn> {
        const turn = await this.bridge.admit(token)
        if (turn === null) throw new AgentToolsError({ code: AgentToolsErrorCode.TokenInvalid })
        return turn
    }

    /** A turn with no conversation has no customer to book for or hand over: only the connector tools (the reads go through the audited read path), and not the playbook sequence, which a person approves for a conversation. */
    async runInternal(turn: BridgeTurn, tool: ToolName, args: ToolArgs): Promise<JsonResult> {
        if (!isGatewayTool(tool) || tool === "tool.sequence") return { error: "needs_conversation" }
        const answer = await this.internal.run(turn, tool, args)
        await this.events.record({
            workspaceId: turn.workspaceId,
            kind: `engine.tool.${tool}`,
            actor: ACTOR,
            summary: `Connector ${tool} in a ${turn.source} turn`,
            evidence: turn.wakeId,
        })
        return answer
    }
}
