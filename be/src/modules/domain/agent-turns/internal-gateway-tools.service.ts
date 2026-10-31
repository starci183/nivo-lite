import { Injectable } from "@nestjs/common"
import type { BridgeTurn, GatewayToolName, InternalTools, JsonResult, ToolArgs } from "@modules/domain/agent-tools"
import {
    argsHashOf,
    gatewayArgumentsSchema,
    gatewayDescribeSchema,
    gatewaySearchSchema,
    McpGatewayService,
} from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewayJson } from "@modules/domain/mcp-gateway"
import { parseJsonText } from "@modules/platform/primitives"
import { AgentWriteRightService } from "./agent-write-right.service"
import { internalCallSchema } from "./internal-gateway-tools.schema"

/** How many tools a search answers when the agent names no limit. */
const SEARCH_LIMIT_DEFAULT = 5
/** The arguments of a call: none when the agent sent none, null when what it sent is no bounded JSON object. */
const argumentsOf = (value: string | undefined): GatewayJson | null => {
    if (value === undefined || value.trim() === "") return {}
    const read = parseJsonText(value)
    if (!read.ok) return null
    const parsed = gatewayArgumentsSchema.safeParse(read.value)
    return parsed.success ? parsed.data : null
}

@Injectable()
/**
 * The connector tools of a turn that has no customer conversation (a tag, an event or a clock). They run through the MCP gateway as the
 * turn's own agent, so its grants, the approved schemas, the breaker and the audit apply, and the tools marked `internalOnly` appear
 * because the call has no conversation. A background turn reads only: a write is refused and the agent proposes an action instead, which
 * a person decides. A tag turn may write only when the colleague who wrote it is an owner or a manager. A call the grants hold for a
 * person is not opened as an approval from here: the agent hears `approval_required` and proposes an action for it.
 */
export class InternalGatewayToolsService implements InternalTools {
    constructor(
        private readonly gateway: McpGatewayService,
        private readonly right: AgentWriteRightService,
    ) {}

    /** Runs one meta-tool for the turn's agent. */
    async run(turn: BridgeTurn, tool: GatewayToolName, args: ToolArgs): Promise<JsonResult> {
        const caller: GatewayCaller = {
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            conversationId: null,
            workItemId: null,
        }
        if (tool === "tool.search") return this.search(caller, args)
        if (tool === "tool.describe") return this.describe(caller, args)
        if (tool === "tool.call") return this.call(turn, caller, args)
        return { error: "needs_conversation" }
    }

    private async search(caller: GatewayCaller, args: ToolArgs): Promise<JsonResult> {
        const parsed = gatewaySearchSchema.safeParse(args)
        if (!parsed.success) return { error: "invalid_arguments" }
        return {
            tools: await this.gateway.search(
                caller,
                parsed.data.query.trim(),
                parsed.data.limit ?? SEARCH_LIMIT_DEFAULT,
            ),
        }
    }

    private async describe(caller: GatewayCaller, args: ToolArgs): Promise<JsonResult> {
        const parsed = gatewayDescribeSchema.safeParse(args)
        if (!parsed.success) return { error: "invalid_arguments" }
        const described = await this.gateway.describe(caller, parsed.data.name.trim())
        return described === null ? { error: "not_granted_or_unknown" } : { ...described }
    }

    private async call(turn: BridgeTurn, caller: GatewayCaller, args: ToolArgs): Promise<JsonResult> {
        const parsed = internalCallSchema.safeParse(args)
        if (!parsed.success) return { error: "invalid_arguments" }
        const name = parsed.data.name.trim()
        const callArgs = argumentsOf(parsed.data.arguments_json)
        if (callArgs === null) return { error: "invalid_arguments", detail: "arguments_json is not a JSON object" }
        const described = await this.gateway.describe(caller, name)
        if (described === null) return { error: "not_granted_or_unknown" }
        if (
            described.scope !== "read" &&
            !(await this.right.mayWrite(turn.source, turn.authorUserId, turn.workspaceId))
        )
            return { error: "read_only_turn" }
        const opKey = `${turn.wakeId}:${name}:${argsHashOf(callArgs).slice(0, 16)}`
        const result = await this.gateway.call({ ...caller, opKey }, name, callArgs)
        if (result.ok) return { result: result.value }
        if (result.code === "approval_required") return { error: "approval_required", reason: result.reason }
        return { error: result.code, detail: result.detail }
    }
}
