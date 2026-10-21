import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { McpToolGrantChange, McpToolGrantRecord } from "./mcp-tool-grants.contracts"
import type {
    McpGrantAgentRow,
    McpGrantIdRow,
    McpToolGrantRow,
    McpWorkspaceGrantRow,
} from "./persistence/mcp-tool-grants.rows"
import {
    AGENTS_GRANTED,
    LIST_AGENT_GRANTS,
    LIST_WORKSPACE_GRANTS,
    UPSERT_GRANT,
    UPSERT_GRANTS,
} from "./persistence/mcp-tool-grants.sql"

/** The batch row of one grant, as UPSERT_GRANTS reads it. */
const batchRowOf = (record: McpToolGrantRecord): Readonly<Record<string, unknown>> => ({
    workspace_id: record.workspaceId,
    agent_id: record.agentId,
    tool: record.tool,
    mode: record.mode,
    limit_vnd: record.limitVnd,
    constraints: record.constraints,
})

@Injectable()
/**
 * The grants of gateway tools to agents (default deny: no row is `never`): the one reader and writer of public.mcp_tool_grants.
 * Judging a call against a grant is the gateway's policy; this capability keeps the rows.
 */
export class McpToolGrantsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The grant rows of one agent. */
    listOfAgent(workspaceId: string, agentId: string): Promise<ReadonlyArray<McpToolGrantRow>> {
        return this.entityManager.query<Array<McpToolGrantRow>>(LIST_AGENT_GRANTS, [workspaceId, agentId])
    }

    /** Every grant row of a workspace with the agent's name. */
    listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<McpWorkspaceGrantRow>> {
        return this.entityManager.query<Array<McpWorkspaceGrantRow>>(LIST_WORKSPACE_GRANTS, [workspaceId])
    }

    /** The agents holding any of the tools (full names or `connector.*`) in a mode other than never, oldest grant first. */
    async agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<McpGrantAgentRow>>(AGENTS_GRANTED, [workspaceId, tools])
        return [...new Set(rows.map((row) => row.agent_id))]
    }

    /** Sets one grant a person chose; false when the agent is not one of the workspace (nothing is written). */
    async set(change: McpToolGrantChange): Promise<boolean> {
        const rows = await this.entityManager.query<Array<McpGrantIdRow>>(UPSERT_GRANT, [
            change.workspaceId,
            change.agentId,
            change.tool,
            change.mode,
            change.limitVnd,
            JSON.stringify(change.constraints),
            change.updatedBy,
        ])
        return rows.length > 0
    }

    /**
     * Sets many grants in one statement (the workspace seed); the last record of an agent and tool wins, and a record whose agent
     * is not of its workspace is skipped. Answers how many grants were written.
     */
    async upsert(rows: ReadonlyArray<McpToolGrantRecord>): Promise<number> {
        const latest = new Map(rows.map((record) => [`${record.agentId}\u0000${record.tool}`, record]))
        if (latest.size === 0) return 0
        const written = await this.entityManager.query<Array<McpGrantIdRow>>(UPSERT_GRANTS, [
            JSON.stringify([...latest.values()].map(batchRowOf)),
        ])
        return written.length
    }
}
