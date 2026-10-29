import { Test } from "@nestjs/testing"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InstallationOperationsService } from "./installation-operations.service"
import { ModuleInstallationEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [InstallationOperationsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(InstallationOperationsService)
}

const installationOf = entityOf(ModuleInstallationEntity, { id: "i1", agentId: "a1" })

/** A manager whose one query builder answers this raw row. */
const answering = (row: unknown) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder({ getRawOne: row })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("InstallationOperationsService > operatingModeOf", () => {
    it("answers the mode of the oldest instance of the module", async () => {
        const { em, fake } = answering({ operatingMode: "assist" })

        await expect((await build(em)).operatingModeOf("ws", "sales", null)).resolves.toBe("assist")
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ModuleInstallationEntity, "i")
        expect(fake.callsOf("where")).toEqual([
            ["i.workspace_id = :workspaceId AND i.module_key = :moduleKey", { workspaceId: "ws", moduleKey: "sales" }],
        ])
        expect(fake.callsOf("andWhere")).toEqual([])
        expect(fake.callsOf("orderBy")).toEqual([["i.created_at", "ASC"]])
        expect(fake.callsOf("addOrderBy")).toEqual([["i.id", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[1]])
    })

    it("narrows to the named instance", async () => {
        const { em, fake } = answering({ operatingMode: "autopilot" })

        await expect((await build(em)).operatingModeOf("ws", "sales", "inst-1")).resolves.toBe("autopilot")
        expect(fake.callsOf("andWhere")).toEqual([["i.id = :installationId", { installationId: "inst-1" }]])
    })

    it("answers null when the module has no such instance", async () => {
        const { em } = answering(undefined)

        await expect((await build(em)).operatingModeOf("ws", "sales", null)).resolves.toBeNull()
    })
})

describe("InstallationOperationsService > agentLinksOf", () => {
    it("lists the instances of the module with their agents, oldest first, bounded", async () => {
        const em = mockEntityManager({ find: [ModuleInstallationEntity, [installationOf()]] })

        await expect((await build(em)).agentLinksOf("ws", "chatbot", 100)).resolves.toEqual([
            { id: "i1", agentId: "a1" },
        ])
        expect(em.find).toHaveBeenCalledWith(ModuleInstallationEntity, {
            select: { id: true, agentId: true },
            where: { workspaceId: "ws", moduleKey: "chatbot" },
            order: { createdAt: "ASC" },
            take: 100,
        })
    })
})
