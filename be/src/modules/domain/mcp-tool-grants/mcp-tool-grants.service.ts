import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
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

/** The key of an agent within its workspace. */
const agentKey = (workspaceId: string, agentId: string): string => `${workspaceId}\u0000${agentId}`

/** The conflict target of a grant: one row per agent and tool. */
const GRANT_KEY: Array<keyof McpToolGrantEntity> = ["agentId", "tool"]

@Injectable()
/**
 * The grants of gateway tools to agents (default deny: no row is `never`): the one reader and writer of public.mcp_tool_grants.
 * Judging a call against a grant is the gateway's policy; this capability keeps the rows.
 */
export class McpToolGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

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

    /** Every grant row of a workspace with the agent's name, by agent name and then tool; a grant of an agent that is gone is left out. */
    async listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<McpWorkspaceGrantView>> {
        const grants = await this.entityManager.find(McpToolGrantEntity, {
            select: { agentId: true, tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId },
            order: { tool: "ASC" },
            take: GRANT_LIMIT,
        })
        const cards = await this.agents.cardsOf(workspaceId, [...new Set(grants.map((grant) => grant.agentId))])
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return grants
            .flatMap((grant): Array<McpWorkspaceGrantView> => {
                const agentName = names.get(grant.agentId)
                return agentName === undefined
                    ? []
                    : [
                          {
                              agent_id: grant.agentId,
                              agent_name: agentName,
                              tool: grant.tool,
                              mode: grant.mode,
                              limit_vnd: grant.limitVnd,
                              constraints: grant.constraints,
                          },
                      ]
            })
            .sort((left, right) => left.agent_name.localeCompare(right.agent_name))
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
        const owned = await this.agents.cardsOf(change.workspaceId, [change.agentId])
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
        const owned = await this.ownedAgentKeys(records)
        const written = records.filter((record) => owned.has(agentKey(record.workspaceId, record.agentId)))
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

    /** The workspace and agent of each record whose agent belongs to the record's own workspace, as `agentKey`s. */
    private async ownedAgentKeys(records: ReadonlyArray<McpToolGrantRecord>): Promise<ReadonlySet<string>> {
        const byWorkspace = new Map<string, Set<string>>()
        for (const record of records) {
            byWorkspace.set(record.workspaceId, (byWorkspace.get(record.workspaceId) ?? new Set()).add(record.agentId))
        }
        const owned = await Promise.all(
            [...byWorkspace].map(async ([workspaceId, agentIds]) =>
                (await this.agents.cardsOf(workspaceId, [...agentIds])).map((card) => agentKey(workspaceId, card.id)),
            ),
        )
        return new Set(owned.flat())
    }
}
