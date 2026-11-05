import { Injectable } from "@nestjs/common"
import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import {
    agentIdFor,
    InjectOpenclawGateway,
    InjectOpenclawGatewayHistory,
    threadKeyFor,
} from "@modules/integrations/openclaw"
import type { GatewayClient, GatewayHistoryClient } from "@modules/integrations/openclaw"
import {
    AGENT_HISTORY_INPUT_SCHEMA,
    AGENT_HISTORY_SCHEMA,
    AGENT_TURN_INPUT_SCHEMA,
    AGENT_TURN_SCHEMA,
} from "./agent-native.schema"

/** The default deadline of a turn, ms. */
const TURN_TIMEOUT_MS = 120_000

/** The deadline of a history read, ms. */
const HISTORY_TIMEOUT_MS = 30_000

/**
 * The agent capability of the NIVO MCP door: `agent.turn` runs one message through an OpenClaw agent of the workspace, and
 * `agent.history` reads the turns of a session. Both are for internal callers only (a declared job, not a customer).
 */
export const AGENT_MANIFEST: NativeConnectorManifest = {
    key: "agent",
    name: "Agent",
    kind: "native",
    contractVersion: "agent-native@1",
    tools: [
        {
            name: "turn",
            description:
                "Sends one message to an agent of the workspace in one session and answers its final text. The same idempotency key is the same turn.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: AGENT_TURN_INPUT_SCHEMA,
            argumentSchema: AGENT_TURN_SCHEMA,
            idempotencyArg: "idempotencyKey",
            internalOnly: true,
        },
        {
            name: "history",
            description: "The turns of one agent session, oldest first: role, text, tool calls and time.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: AGENT_HISTORY_INPUT_SCHEMA,
            argumentSchema: AGENT_HISTORY_SCHEMA,
            internalOnly: true,
        },
    ],
}

@Injectable()
/** Runs the tools of the agent connector over the OpenClaw gateway; the agent is always one of the calling workspace. */
export class AgentNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = AGENT_MANIFEST

    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawGatewayHistory() private readonly history: GatewayHistoryClient,
    ) {}

    /** Runs one agent tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, _caller: NativeCaller): Promise<GatewayJson> {
        if (tool === "turn") return this.turn(workspaceId, args)
        if (tool === "history") return this.read(workspaceId, args)
        throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
    }

    private async turn(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = AGENT_TURN_SCHEMA.safeParse(args)
        if (!parsed.success || parsed.data.idempotencyKey === undefined)
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "turn" } })
        const agentId = agentIdFor(workspaceId, parsed.data.agentKey)
        const result = await this.gateway.runTurn(
            {
                agentId,
                threadKey: threadKeyFor(agentId, parsed.data.sessionKey),
                message: parsed.data.message,
                idempotencyKey: parsed.data.idempotencyKey,
                timeoutMs: parsed.data.timeoutMs ?? TURN_TIMEOUT_MS,
            },
            new AbortController().signal,
        )
        return { text: result.text }
    }

    private async read(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = AGENT_HISTORY_SCHEMA.safeParse(args)
        if (!parsed.success)
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "history" } })
        const agentId = agentIdFor(workspaceId, parsed.data.agentKey)
        const turns = await this.history.read(
            { threadKey: threadKeyFor(agentId, parsed.data.sessionKey), timeoutMs: HISTORY_TIMEOUT_MS },
            new AbortController().signal,
        )
        return {
            turns: turns.map((turn) => ({
                index: turn.index,
                role: turn.role,
                text: turn.text,
                toolCalls: turn.toolCalls.map((call) => ({ name: call.name, argsJson: call.argsJson })),
                at: turn.at,
            })),
        }
    }
}
