import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ExecutionsErrorCode } from "./errors/executions.error"
import type { NewExecution } from "./executions.contracts"
import { ExecutionsService } from "./executions.service"
import { INSERT_EXECUTION } from "./persistence/executions.sql"

const card: NewExecution = {
    workspaceId: "ws-1",
    responsibilityId: "resp-1",
    agentId: null,
    draft: "Hello",
    workItemId: "item-1",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ExecutionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ExecutionsService)
}

describe("ExecutionsService", () => {
    it("creates the approval card and answers its id", async () => {
        const em = mockEntityManager({ query: [INSERT_EXECUTION, [{ id: "exec-1" }]] })

        expect(await (await build(em)).open(card)).toBe("exec-1")
        expect(em.query).toHaveBeenCalledWith(INSERT_EXECUTION, ["ws-1", "resp-1", null, "Hello", "item-1"])
    })

    it("is a typed error when the insert answers no row", async () => {
        const service = await build(mockEntityManager({ query: [INSERT_EXECUTION, []] }))

        await expect(service.open(card)).rejects.toThrow(ExecutionsErrorCode.NotCreated)
    })
})
