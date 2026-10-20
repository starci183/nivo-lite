import { createHash, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMcpGatewayOptions } from "./mcp-gateway.decorators"
import type { GatewayCaller, JsonObject } from "./mcp-gateway.contracts"
import type { McpGatewayOptions } from "./mcp-gateway.options"
import { McpGatewayService } from "./mcp-gateway.service"
import { AGENT_OF_WORKSPACE } from "./persistence/mcp-gateway.sql"

/** One tool of the gateway's own MCP surface. */
export interface SurfaceTool {
    /** The name. */
    readonly name: string
    /** What it does. */
    readonly description: string
    /** Its JSON schema. */
    readonly inputSchema: JsonObject
}

/** What a surface tool answered: the JSON result and whether it is an error. */
export interface SurfaceAnswer {
    /** The result. */
    readonly value: JsonObject
    /** True when the call did not succeed. */
    readonly isError: boolean
}

const SEARCH_LIMIT_DEFAULT = 5

/**
 * The three tools every agent sees on the gateway's single MCP endpoint, however many connectors the workspace has: search the tools
 * granted to it, describe one (schema and limits), and call one. Every call goes through `McpGatewayService.call`, so the grants, the
 * approval, the breaker, the time limit and the audit apply to agents exactly as to NIVO's own performers.
 */
export const SURFACE_TOOLS: ReadonlyArray<SurfaceTool> = [
    {
        name: "gateway.search",
        description:
            "Find the connector tools you may use (for example 'spa slots', 'bank transactions'). Answers at most 10.",
        inputSchema: {
            type: "object",
            properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 10 } },
            required: ["query"],
        },
    },
    {
        name: "gateway.describe",
        description:
            "The JSON schema, mode and limits of one tool, by its full name (for example hakuen.booking.hold).",
        inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
    {
        name: "gateway.call",
        description:
            "Call one tool by its full name with its arguments. A call over your limits waits for a person's approval.",
        inputSchema: {
            type: "object",
            properties: { name: { type: "string" }, arguments: { type: "object" } },
            required: ["name"],
        },
    },
]

const isObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const digestOf = (text: string): Buffer => createHash("sha256").update(text).digest()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

@Injectable()
/** Runs the gateway's own MCP surface for one authenticated caller. */
export class GatewaySurfaceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMcpGatewayOptions() private readonly options: McpGatewayOptions,
        private readonly gateway: McpGatewayService,
    ) {}

    /**
     * The caller of a request to the endpoint: the bearer must be the gateway's agent token (compared in constant time) and the agent
     * one of the workspace; anything else is null. A gateway without a token is closed.
     */
    async authenticate(
        workspaceId: string,
        agentId: string,
        authorization: string | undefined,
    ): Promise<GatewayCaller | null> {
        const token = this.options.agentToken
        const bearer = /^Bearer (.+)$/u.exec(authorization ?? "")?.[1] ?? ""
        if (token === null || bearer === "" || !UUID.test(workspaceId) || !UUID.test(agentId)) return null
        if (!timingSafeEqual(digestOf(bearer), digestOf(token.reveal()))) return null
        const rows: ReadonlyArray<unknown> = await this.entityManager.query(AGENT_OF_WORKSPACE, [workspaceId, agentId])
        return rows.length === 0 ? null : { workspaceId, agentId, conversationId: null, workItemId: null }
    }

    /** Runs one surface tool. */
    async run(caller: GatewayCaller, tool: string, args: JsonObject): Promise<SurfaceAnswer> {
        if (tool === "gateway.search") {
            const limit = typeof args.limit === "number" ? args.limit : SEARCH_LIMIT_DEFAULT
            const tools = await this.gateway.search(caller, textOf(args.query), limit)
            return { value: { tools }, isError: false }
        }
        if (tool === "gateway.describe") {
            const described = await this.gateway.describe(caller, textOf(args.name))
            return described === null
                ? { value: { error: "not_granted_or_unknown" }, isError: true }
                : { value: { ...described }, isError: false }
        }
        if (tool === "gateway.call") {
            const result = await this.gateway.call(
                caller,
                textOf(args.name),
                isObject(args.arguments) ? args.arguments : {},
            )
            return result.ok ? { value: result.value, isError: false } : { value: { ...result }, isError: true }
        }
        return { value: { error: "unknown_tool" }, isError: true }
    }
}
