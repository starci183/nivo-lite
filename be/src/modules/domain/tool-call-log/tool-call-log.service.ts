import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    CallLogLine,
    CallLogPage,
    CallLogRecord,
    CallRecordsTally,
    CallRecordsWindow,
    RunTruthReads,
} from "./tool-call-log.contracts"
import { NO_CALLS, callRecordsTallyOf, type CallRecordsRow } from "./tool-call-log.mapper"
import { ToolCallLogEntity } from "./persistence/entities"

/** One audit line as the statement selects it, before the agent name is attached. */
type CallLogRow = Omit<CallLogRecord, "agent_name"> & { readonly agent_id: string | null }

/** The connector of the effect-rights verdict lines: a verdict, never a call, so it touches no record. */
const EFFECT_RIGHTS = "effect-rights"

/** The most runs one tally reads: a page of the runs list. */
const RUNS_MAX = 50

@Injectable()
/** The audit of the tools registry: the one reader and writer of public.mcp_call_log; lines are appended, never changed. */
export class ToolCallLogService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** Appends one audit line. */
    async append(line: CallLogLine): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ToolCallLogEntity, "mcl")
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
                runId: line.runId ?? null,
                factReads: () => "CAST(:factReadsJson AS jsonb)",
                originKind: line.originKind ?? null,
                nodeKey: line.nodeKey ?? null,
                workflowId: line.workflowId ?? null,
                workflowVersionId: line.workflowVersionId ?? null,
                recordsRead: line.recordsRead ?? null,
                recordsChanged: line.recordsChanged ?? null,
                connectionId: line.connectionId ?? null,
                provider: line.provider ?? null,
                attempt: line.attempt ?? null,
                chosenBy: line.chosenBy ?? null,
                apiKeyId: line.apiKeyId ?? null,
                actorUserId: line.actorUserId ?? null,
            })
            .setParameter("argsMaskedJson", line.argsMaskedJson)
            .setParameter("factReadsJson", line.factReads == null ? null : JSON.stringify(line.factReads))
            .execute()
    }

    /**
     * The truth-graph reads of one run, oldest first, at most `limit`: the audit lines of the run that kept the truths they served
     * (`fact_reads`), read on `mcp_call_log_run` (migration 20261112015300).
     */
    async truthReadsOfRun(workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<RunTruthReads>> {
        const rows = await this.entityManager
            .createQueryBuilder(ToolCallLogEntity, "l")
            .select(["l.id", "l.tool", "l.createdAt", "l.factReads"])
            .where("l.workspaceId = :workspaceId AND l.runId = :runId AND l.factReads IS NOT NULL", {
                workspaceId,
                runId,
            })
            .orderBy("l.createdAt", "ASC")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({ id: row.id, tool: row.tool, at: row.createdAt, facts: row.factReads ?? [] }))
    }

    /**
     * The connected accounts the `ok` calls of one run acted on, the most recent first, each once, at most `limit`: what the run already
     * used (the account a call ran on is recorded per call by the tool runner), read on `mcp_call_log_run`. A call that handed no account
     * and the effect-rights verdict lines name none.
     */
    async connectionsUsedByRun(workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(ToolCallLogEntity, "l")
            .select(["l.id", "l.connectionId", "l.createdAt"])
            .where(
                "l.workspaceId = :workspaceId AND l.runId = :runId AND l.connectionId IS NOT NULL AND l.outcome = 'ok' AND l.connector <> :effectRights",
                { workspaceId, runId, effectRights: EFFECT_RIGHTS },
            )
            .orderBy("l.createdAt", "DESC")
            .limit(limit)
            .getMany()
        return [...new Set(rows.flatMap((row) => (row.connectionId === null ? [] : [row.connectionId])))]
    }

    /**
     * The records the `ok` calls of each run touched, one tally per run that made a call (at most `RUNS_MAX` runs): the sums of the counts
     * their adapters stated, on `mcp_call_log_run` (migration 20261112021900). The effect-rights verdict lines are no calls.
     */
    async recordsOfRuns(workspaceId: string, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<CallRecordsTally>> {
        const runs = [...new Set(runIds)].slice(0, RUNS_MAX)
        if (runs.length === 0) return []
        const rows = await this.recordsQuery()
            .addSelect("l.run_id", "run_id")
            .where("l.workspace_id = :workspaceId AND l.run_id IN (:...runs)", { workspaceId, runs })
            .andWhere("l.outcome = 'ok' AND l.connector <> :effectRights", { effectRights: EFFECT_RIGHTS })
            .groupBy("l.run_id")
            .limit(runs.length)
            .getRawMany<CallRecordsRow>()
        return rows.map((row) => callRecordsTallyOf(row))
    }

    /** The records the `ok` calls of one agent touched in a window of time, on `mcp_call_log_agent_time` (migration 20261112021900). */
    async recordsOfAgent(window: CallRecordsWindow): Promise<CallRecordsTally> {
        const row = await this.recordsQuery()
            .addSelect("NULL", "run_id")
            .where("l.workspace_id = :workspaceId AND l.agent_id = :agentId", {
                workspaceId: window.workspaceId,
                agentId: window.agentId,
            })
            .andWhere("l.created_at >= :from AND l.created_at < :to", { from: window.from, to: window.to })
            .andWhere("l.outcome = 'ok' AND l.connector <> :effectRights", { effectRights: EFFECT_RIGHTS })
            .getRawOne<CallRecordsRow>()
        return row === undefined ? NO_CALLS : callRecordsTallyOf(row)
    }

    /** The measures of a records tally: every `ok` call, the stated sums and how many stated each, and the calls that stated none. */
    private recordsQuery(): SelectQueryBuilder<ToolCallLogEntity> {
        return this.entityManager
            .createQueryBuilder(ToolCallLogEntity, "l")
            .select("count(*)", "calls")
            .addSelect("sum(l.records_read)", "read_sum")
            .addSelect("count(l.records_read)", "read_stated")
            .addSelect("sum(l.records_changed)", "changed_sum")
            .addSelect("count(l.records_changed)", "changed_stated")
            .addSelect("count(*) FILTER (WHERE l.records_read IS NULL AND l.records_changed IS NULL)", "uncounted")
    }

    /** The newest audit lines of a workspace, newest first, each with the name of the agent that made the call. */
    async latest(page: CallLogPage): Promise<ReadonlyArray<CallLogRecord>> {
        const lines = await this.entityManager
            .createQueryBuilder(ToolCallLogEntity, "l")
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
