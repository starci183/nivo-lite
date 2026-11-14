import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ToolGrantView,
    WorkspaceGrantView,
    OperationMove,
    RekeyOutcome,
    ToolGrantKey,
} from "./tool-grants.contracts"
import { ToolGrantEntity } from "./persistence/entities"

/** The most grants one read answers. */
const GRANT_LIMIT = 500

@Injectable()
/**
 * The grants of gateway tools to agents (default deny: no row is `never`): the one reader and writer of public.mcp_tool_grants.
 * Judging a call against a grant is the gateway's policy; this capability keeps the rows.
 */
export class ToolGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The grant rows of one agent. */
    async listOfAgent(workspaceId: string, agentId: string): Promise<ReadonlyArray<ToolGrantView>> {
        const grants = await this.entityManager.find(ToolGrantEntity, {
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
    async listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<WorkspaceGrantView>> {
        const grants = await this.entityManager.find(ToolGrantEntity, {
            select: { agentId: true, tool: true, mode: true, limitVnd: true, constraints: true },
            where: { workspaceId },
            order: { tool: "ASC" },
            take: GRANT_LIMIT,
        })
        const cards = await this.agents.cardsOf(workspaceId, [...new Set(grants.map((grant) => grant.agentId))])
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return grants
            .flatMap((grant): Array<WorkspaceGrantView> => {
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

    /** Every grant row of a workspace as whose it is and the tool it names (a row of an agent that is gone included), by tool. */
    async toolKeysOf(workspaceId: string): Promise<ReadonlyArray<ToolGrantKey>> {
        const grants = await this.entityManager.find(ToolGrantEntity, {
            select: { agentId: true, tool: true },
            where: { workspaceId },
            order: { tool: "ASC" },
            take: GRANT_LIMIT,
        })
        return grants.map((grant) => ({ agentId: grant.agentId, tool: grant.tool }))
    }

    /**
     * Gives the grant rows of a workspace their new tool names: a row that names `from` names `to` and keeps its mode, limit and
     * constraints. Where the same agent already holds a row for `to`, that row is kept as it is and the row under the old name goes.
     * One transaction.
     */
    rekeyTools(workspaceId: string, moves: ReadonlyArray<OperationMove>): Promise<RekeyOutcome> {
        const targets = new Map(moves.map((move) => [move.from, move.to]))
        if (targets.size === 0) return Promise.resolve({ rekeyed: 0, merged: 0 })
        return this.entityManager.transaction(async (tx) => {
            const [old, renamed] = await Promise.all([
                tx.find(ToolGrantEntity, { where: { workspaceId, tool: In([...targets.keys()]) }, take: GRANT_LIMIT }),
                tx.find(ToolGrantEntity, { where: { workspaceId, tool: In([...targets.values()]) }, take: GRANT_LIMIT }),
            ])
            const held = new Set(renamed.map((row) => `${row.agentId}:${row.tool}`))
            const duplicates = old.filter((row) => held.has(`${row.agentId}:${targets.get(row.tool) ?? row.tool}`))
            const movable = old.filter((row) => !duplicates.includes(row))
            if (duplicates.length > 0) await tx.delete(ToolGrantEntity, { id: In(duplicates.map((row) => row.id)) })
            await Promise.all(
                movable.map((row) => tx.update(ToolGrantEntity, { id: row.id }, { tool: targets.get(row.tool) ?? row.tool })),
            )
            return { rekeyed: movable.length, merged: duplicates.length }
        })
    }

    /** The agents holding a grant row of any of the tools (full names or `connector.*`), oldest grant first. */
    async agentsGranted(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const grants = await this.entityManager.find(ToolGrantEntity, {
            select: { agentId: true },
            where: { workspaceId, tool: In([...tools]), mode: In(["auto", "ask"]) },
            order: { updatedAt: "ASC" },
            take: GRANT_LIMIT,
        })
        return [...new Set(grants.map((grant) => grant.agentId))]
    }
}
