import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentViewScopeService } from "./agent-view-scope.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentViewScopeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentViewScopeService)
}

describe("AgentViewScopeService > lensOf", () => {
    it("scopes a multi-instance agent to its installation", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [
            { getRawOne: { module: "sales", installation_id: "i1", is_multi: true } },
        ])

        await expect((await build(em)).lensOf("w1", "a1")).resolves.toEqual({ module: "sales", installationId: "i1" })
        expect(read?.argsOf("where")).toContainEqual([
            "a.workspaceId = :workspaceId AND a.id = :agentId",
            { workspaceId: "w1", agentId: "a1" },
        ])
        expect(read?.argsOf("leftJoin")).toContainEqual([
            "module_installations",
            "i",
            "i.agent_id = a.id AND i.workspace_id = a.workspace_id",
        ])
    })

    it("gives a single-instance agent the shared knowledge only, with or without an installation", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [
            { getRawOne: { module: "chatbot", installation_id: "i2", is_multi: false } },
            { getRawOne: { module: "chatbot", installation_id: null, is_multi: null } },
        ])
        const service = await build(em)

        await expect(service.lensOf("w1", "a1")).resolves.toEqual({ module: "chatbot", installationId: null })
        await expect(service.lensOf("w1", "a2")).resolves.toEqual({ module: "chatbot", installationId: null })
    })

    it("answers null for an agent the workspace does not hold", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawOne: undefined }])

        await expect((await build(em)).lensOf("w1", "gone")).resolves.toBeNull()
    })
})
