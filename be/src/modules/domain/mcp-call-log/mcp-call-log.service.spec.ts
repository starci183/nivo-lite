import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { McpCallLogService } from "./mcp-call-log.service"
import type { McpCallLogRow } from "./persistence/mcp-call-log.rows"
import { INSERT_CALL_LOG, LIST_CALL_LOG } from "./persistence/mcp-call-log.sql"

const ROW: McpCallLogRow = {
    id: "log-1",
    tool: "hakuen.booking.hold",
    agent_name: "AI Sales",
    outcome: "ok",
    error_code: null,
    args_masked: "{}",
    result_summary: "{}",
    duration_ms: 12,
    approved_by: null,
    created_at: "2026-10-20T02:00:00.000Z",
}

const build = async (entityManager: MockEntityManager): Promise<McpCallLogService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpCallLogService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpCallLogService)
}

describe("McpCallLogService", () => {
    it("appends one audit line with every column in order", async () => {
        const em = mockEntityManager({ query: [INSERT_CALL_LOG, []] })
        const log = await build(em)

        await expect(
            log.append({
                workspaceId: "ws-1",
                connector: "hakuen",
                tool: "hakuen.booking.hold",
                agentId: "agent-1",
                conversationId: "conv-1",
                workItemId: null,
                argsMaskedJson: '{"code":"***"}',
                argsHash: "hash",
                outcome: "ok",
                errorCode: null,
                resultSummary: "{}",
                durationMs: 12,
                approvedBy: "person-1",
            }),
        ).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(INSERT_CALL_LOG, [
            "ws-1",
            "hakuen",
            "hakuen.booking.hold",
            "agent-1",
            "conv-1",
            null,
            '{"code":"***"}',
            "hash",
            "ok",
            null,
            "{}",
            12,
            "person-1",
        ])
    })

    it("reads the newest lines of the workspace within the page", async () => {
        const em = mockEntityManager({ query: [LIST_CALL_LOG, [ROW]] })
        const log = await build(em)

        await expect(log.latest({ workspaceId: "ws-1", limit: 50 })).resolves.toEqual([ROW])
        expect(em.query).toHaveBeenCalledWith(LIST_CALL_LOG, ["ws-1", 50])
    })
})
