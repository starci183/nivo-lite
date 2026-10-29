import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    McpToolGrantChange,
    McpToolGrantRecord,
    McpToolGrantView,
    McpWorkspaceGrantView,
} from "./mcp-tool-grants.contracts"
import { McpToolGrantEntity } from "./persistence/entities"

/** The most grants one read answers. */
const GRANT_LIMIT = 500

/** The conflict target of a grant: one row per agent and tool. */
const GRANT_KEY: Array<keyof McpToolGrantEntity> = ["agentId", "tool"]

/** An agent of a workspace, read to prove a grant targets one of the workspace's own agents. */
interface AgentOwnerRow {
    /** The agent. */
    readonly id: string
    /** The workspace the agent belongs to. */
    readonly workspace_id: string
}

@Injectable()
/**
 * The grants of gateway tools to agents (default deny: no row is `never`): the one reader and writer of public.mcp_tool_grants.
 * Judging a call against a grant is the gateway's policy; this capability keeps the rows.
 */
export class McpToolGrantsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The grant rows of one agent. */
    async listOfAgent(workspaceId: string, agentId: string): Promise<ReadonlyArray<McpToolGrantView>> {
        const grants = await this.entityManager.find(McpToolGrantEntity, {
            select: { tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId, agentId },
            order: { tool: "ASC" },
            take: GRANT_LIMIT,
        })
        return grants.map((grant) => ({
            tool: grant.tool,
            mode: grant.mode,
            limit_vnd: grant.limitVnd,
            constraints: grant.constraints,
        }))
    }

    /** Every grant row of a workspace with the agent's name. */
    listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<McpWorkspaceGrantView>> {
        return this.entityManager
            .createQueryBuilder(McpToolGrantEntity, "g")
            .innerJoin("agents", "a", "a.id = g.agent_id")
            .select("g.agent_id", "agent_id")
            .addSelect("a.name", "agent_name")
            .addSelect("g.tool", "tool")
            .addSelect("g.mode", "mode")
            .addSelect("g.limit_vnd", "limit_vnd")
            .addSelect("g.constraints", "constraints")
            .where("g.workspace_id = :workspaceId", { workspaceId })
            .orderBy("a.name", "ASC")
            .addOrderBy("g.tool", "ASC")
            .limit(GRANT_LIMIT)
            .getRawMany<McpWorkspaceGrantView>()
    }

    /** The agents holding any of the tools (full names or `connector.*`) in a mode other than never, oldest grant first. */
    async agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const grants = await this.entityManager.find(McpToolGrantEntity, {
            select: { agentId: true },
            where: { workspaceId, tool: In([...tools]), mode: Not("never") },
            order: { updatedAt: "ASC" },
            take: GRANT_LIMIT,
        })
        return [...new Set(grants.map((grant) => grant.agentId))]
    }

    /** Sets one grant a person chose; false when the agent is not one of the workspace (nothing is written). */
    async set(change: McpToolGrantChange): Promise<boolean> {
        const owned = await this.ownedAgents(change.workspaceId, [change.agentId])
        if (owned.length === 0) return false
        await this.entityManager.upsert(
            McpToolGrantEntity,
            {
                workspaceId: change.workspaceId,
                agentId: change.agentId,
                tool: change.tool,
                mode: change.mode,
                limitVnd: change.limitVnd,
                constraints: [...change.constraints],
                updatedBy: change.updatedBy,
                updatedAt: () => "now()",
            },
            GRANT_KEY,
        )
        return true
    }

    /**
     * Sets many grants in one statement (the workspace seed); the last record of an agent and tool wins, and a record whose agent
     * is not of its workspace is skipped. Answers how many grants were written.
     */
    async upsert(rows: ReadonlyArray<McpToolGrantRecord>): Promise<number> {
        const latest = new Map(rows.map((record) => [`${record.agentId}\u0000${record.tool}`, record]))
        if (latest.size === 0) return 0
        const records = [...latest.values()]
        const agents = await this.agentsOf(records.map((record) => record.agentId))
        const written = records.filter((record) => agents.get(record.agentId) === record.workspaceId)
        if (written.length === 0) return 0
        await this.entityManager.upsert(
            McpToolGrantEntity,
            written.map((record) => ({
                workspaceId: record.workspaceId,
                agentId: record.agentId,
                tool: record.tool,
                mode: record.mode,
                limitVnd: record.limitVnd,
                constraints: [...record.constraints],
                updatedBy: null,
                updatedAt: () => "now()",
            })),
            GRANT_KEY,
        )
        return written.length
    }

    /** The agents among `agentIds` that belong to the workspace. */
    private async ownedAgents(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const agents = await this.agentsOf(agentIds)
        return agentIds.filter((agentId) => agents.get(agentId) === workspaceId)
    }

    /** The workspace of each agent in `agentIds` (agents are another capability's table, joined by name). */
    private async agentsOf(agentIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        const rows = await this.entityManager
            .createQueryBuilder()
            .select("a.id", "id")
            .addSelect("a.workspace_id", "workspace_id")
            .from("public.agents", "a")
            .where("a.id IN (:...agentIds)", { agentIds: [...new Set(agentIds)] })
            .getRawMany<AgentOwnerRow>()
        return new Map(rows.map((row) => [row.id, row.workspace_id]))
    }
}
