import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CallLogLine, CallLogPage, CallLogRecord } from "./mcp-call-log.contracts"

/** One audit line as the statement selects it, before the agent name is attached. */
type CallLogRow = Omit<CallLogRecord, "agent_name"> & { readonly agent_id: string | null }
import { McpCallLogEntity } from "./persistence/entities"

@Injectable()
/** The audit of the MCP gateway: the one reader and writer of public.mcp_call_log; lines are appended, never changed. */
export class McpCallLogService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** Appends one audit line. */
    async append(line: CallLogLine): Promise<void> {
        await this.entityManager
            .createQueryBuilder(McpCallLogEntity, "mcl")
            .insert()
            .values({
                workspaceId: line.workspaceId,
                connector: line.connector,
                tool: line.tool,
                agentId: line.agentId,
                conversationId: line.conversationId,
                workItemId: line.workItemId,
                argsMasked: () => "CAST(:argsMaskedJson AS jsonb)",
                argsHash: line.argsHash,
                outcome: line.outcome,
                errorCode: line.errorCode,
                resultSummary: line.resultSummary,
                durationMs: line.durationMs,
                approvedBy: line.approvedBy,
            })
            .setParameter("argsMaskedJson", line.argsMaskedJson)
            .execute()
    }

    /** The newest audit lines of a workspace, newest first, each with the name of the agent that made the call. */
    async latest(page: CallLogPage): Promise<ReadonlyArray<CallLogRecord>> {
        const lines = await this.entityManager
            .createQueryBuilder(McpCallLogEntity, "l")
            .select("l.id", "id")
            .addSelect("l.tool", "tool")
            .addSelect("l.agent_id", "agent_id")
            .addSelect("l.outcome", "outcome")
            .addSelect("l.error_code", "error_code")
            .addSelect("l.args_masked::text", "args_masked")
            .addSelect("l.result_summary", "result_summary")
            .addSelect("l.duration_ms", "duration_ms")
            .addSelect("l.approved_by", "approved_by")
            .addSelect("l.created_at", "created_at")
            .where("l.workspace_id = :workspaceId", { workspaceId: page.workspaceId })
            .orderBy("l.created_at", "DESC")
            .limit(page.limit)
            .getRawMany<CallLogRow>()
        const cards = await this.agents.cardsOf(
            page.workspaceId,
            lines.flatMap((line) => (line.agent_id === null ? [] : [line.agent_id])),
        )
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return lines.map(({ agent_id: agentId, ...line }): CallLogRecord => ({
            ...line,
            agent_name: names.get(agentId ?? "") ?? "",
        }))
    }
}
