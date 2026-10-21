import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CallLogLine, CallLogPage } from "./mcp-call-log.contracts"
import type { McpCallLogRow } from "./persistence/mcp-call-log.rows"
import { INSERT_CALL_LOG, LIST_CALL_LOG } from "./persistence/mcp-call-log.sql"

@Injectable()
/** The audit of the MCP gateway: the one reader and writer of public.mcp_call_log; lines are appended, never changed. */
export class McpCallLogService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Appends one audit line. */
    async append(line: CallLogLine): Promise<void> {
        await this.entityManager.query(INSERT_CALL_LOG, [
            line.workspaceId,
            line.connector,
            line.tool,
            line.agentId,
            line.conversationId,
            line.workItemId,
            line.argsMaskedJson,
            line.argsHash,
            line.outcome,
            line.errorCode,
            line.resultSummary,
            line.durationMs,
            line.approvedBy,
        ])
    }

    /** The newest audit lines of a workspace, newest first. */
    latest(page: CallLogPage): Promise<ReadonlyArray<McpCallLogRow>> {
        return this.entityManager.query<Array<McpCallLogRow>>(LIST_CALL_LOG, [page.workspaceId, page.limit])
    }
}
