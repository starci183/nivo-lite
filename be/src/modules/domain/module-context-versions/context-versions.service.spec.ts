import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContextVersionRecord, NewContextVersion } from "./module-context-versions.contracts"
import { ModuleContextVersionEntity } from "./persistence/entities"
import { ContextVersionsService } from "./context-versions.service"

const snapshot: ContextVersionRecord["snapshot"] = {
    summary: "A tea shop in Hue",
    facts: [{ key: "city", text: "Hue" }],
    gates: { tone: { status: "confirmed", evidence: "warm" } },
}

const version: ContextVersionRecord = {
    id: "ver-1",
    installationId: "inst-1",
    version: 2,
    snapshot,
    appliedBy: "Lan",
    appliedAt: "2026-10-12T10:00:00.000Z",
}

const row = Object.assign(new ModuleContextVersionEntity(), {
    id: "ver-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    version: 2,
    snapshot,
    appliedBy: "Lan",
    appliedAt: new Date("2026-10-12T10:00:00.000Z"),
})

const created: NewContextVersion = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    version: 2,
    snapshot,
    appliedBy: "Lan",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContextVersionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContextVersionsService)
}

describe("ContextVersionsService", () => {
    it("lists the versions of an installation, newest first", async () => {
        const em = mockEntityManager({ find: [ModuleContextVersionEntity, [row]] })

        await expect((await build(em)).list("inst-1")).resolves.toEqual([version])

        expect(em.find).toHaveBeenCalledWith(ModuleContextVersionEntity, {
            where: { installationId: "inst-1" },
            order: { version: "DESC" },
            take: 100,
        })
    })

    it("finds one version by id", async () => {
        const em = mockEntityManager({ findOne: [ModuleContextVersionEntity, row] })

        await expect((await build(em)).find("ver-1")).resolves.toEqual(version)

        expect(em.findOne).toHaveBeenCalledWith(ModuleContextVersionEntity, { where: { id: "ver-1" } })
    })

    it("answers nothing when the version id is unknown", async () => {
        const em = mockEntityManager({ findOne: [ModuleContextVersionEntity, null] })

        await expect((await build(em)).find("missing")).resolves.toBeNull()
    })

    it("finds the newest version of an installation", async () => {
        const em = mockEntityManager({ findOne: [ModuleContextVersionEntity, row] })

        await expect((await build(em)).latest("inst-1")).resolves.toEqual(version)

        expect(em.findOne).toHaveBeenCalledWith(ModuleContextVersionEntity, {
            where: { installationId: "inst-1" },
            order: { version: "DESC" },
        })
    })

    it("answers nothing before the first apply", async () => {
        const em = mockEntityManager({ findOne: [ModuleContextVersionEntity, null] })

        await expect((await build(em)).latest("inst-1")).resolves.toBeNull()
    })

    it("stores an immutable version", async () => {
        const em = mockEntityManager({ save: [ModuleContextVersionEntity, row] })

        await expect((await build(em)).insert(created)).resolves.toEqual(version)

        expect(em.save).toHaveBeenCalledWith(
            ModuleContextVersionEntity,
            expect.objectContaining({
                workspaceId: "ws-1",
                installationId: "inst-1",
                version: 2,
                snapshot,
                appliedBy: "Lan",
            }),
        )
    })
})
