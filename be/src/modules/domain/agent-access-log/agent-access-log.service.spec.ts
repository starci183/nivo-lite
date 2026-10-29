import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentAccessLogService } from "./agent-access-log.service"
import { AgentAccessLogEntity } from "./persistence/entities"

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
    it("writes the change in the given transaction", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager({ insert: [AgentAccessLogEntity, {}] })
        const moduleRef = await Test.createTestingModule({
            providers: [AgentAccessLogService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()

        await expect(moduleRef.get(AgentAccessLogService).record(CHANGE, tx)).resolves.toBeUndefined()

        expect(tx.insert).toHaveBeenCalledWith(AgentAccessLogEntity, {
            workspaceId: "ws-1",
            connectionId: "c-1",
            agentId: "a-1",
            connectionName: "Bank",
            agentName: "Sales",
            beforeAccess: null,
            afterAccess: "ask",
            changedBy: "u-1",
            changedByName: "An",
        })
        expect(primary.insert).not.toHaveBeenCalled()
    })
})
