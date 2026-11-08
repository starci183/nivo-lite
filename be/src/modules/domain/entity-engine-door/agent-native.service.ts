import { Injectable } from "@nestjs/common"
import {
    RoutedNativeAdapter,
    argumentsOf,
    invalidArguments,
    type GatewayJson,
    type NativeConnectorManifest,
    type NativeToolHandler,
} from "@modules/domain/mcp-gateway"
import {
    agentIdFor,
    InjectOpenclawGateway,
    InjectOpenclawGatewayHistory,
    threadKeyFor,
    type GatewayClient,
    type GatewayHistoryClient,
} from "@modules/integrations/openclaw"
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
export class AgentNativeService extends RoutedNativeAdapter {
    readonly manifest: NativeConnectorManifest = AGENT_MANIFEST

    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawGatewayHistory() private readonly history: GatewayHistoryClient,
    ) {
        super()
    }

    protected readonly handlers: ReadonlyMap<string, NativeToolHandler> = new Map([
        ["turn", (workspaceId, args) => this.turn(workspaceId, args)],
        ["history", (workspaceId, args) => this.read(workspaceId, args)],
    ])

    private async turn(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = argumentsOf("turn", AGENT_TURN_SCHEMA, args)
        if (parsed.idempotencyKey === undefined) throw invalidArguments("turn")
        const agentId = agentIdFor(workspaceId, parsed.agentKey)
        const result = await this.gateway.runTurn(
            {
                agentId,
                threadKey: threadKeyFor(agentId, parsed.sessionKey),
                message: parsed.message,
                idempotencyKey: parsed.idempotencyKey,
                timeoutMs: parsed.timeoutMs ?? TURN_TIMEOUT_MS,
            },
            new AbortController().signal,
        )
        return { text: result.text }
    }

    private async read(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = argumentsOf("history", AGENT_HISTORY_SCHEMA, args)
        const agentId = agentIdFor(workspaceId, parsed.agentKey)
        const turns = await this.history.read(
            { threadKey: threadKeyFor(agentId, parsed.sessionKey), timeoutMs: HISTORY_TIMEOUT_MS },
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
