import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentAccessLogService } from "./agent-access-log.service"
import { INSERT_AGENT_ACCESS_LOG } from "./persistence/agent-access-log.sql"

const CHANGE = {
    workspaceId: "ws-1",
    connectionId: "c-1",
    agentId: "a-1",
    connectionName: "Bank",
    agentName: "Sales",
    before: null,
    after: "ask",
    changedBy: "u-1",
    changedByName: "An",
}

describe("AgentAccessLogService", () => {
    it("writes the change in the given transaction, in column order", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager({ query: [INSERT_AGENT_ACCESS_LOG, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [AgentAccessLogService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()

        await expect(moduleRef.get(AgentAccessLogService).record(CHANGE, tx)).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(INSERT_AGENT_ACCESS_LOG, [
            "ws-1",
            "c-1",
            "a-1",
            "Bank",
            "Sales",
            null,
            "ask",
            "u-1",
            "An",
        ])
        expect(primary.query).not.toHaveBeenCalled()
    })
})
