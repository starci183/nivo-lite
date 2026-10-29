import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentPillarsService } from "./content-pillars.service"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import {
    deleteAllOfWs1,
    deleteExceptPillar1,
    paddedDrafts,
    paddedInserted,
    pillarRow,
} from "@tests/fixtures/builders/content-pillars.builder"
import { ContentPillarEntity } from "./persistence/entities"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentPillarsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContentPillarsService)
}

const registerReads = () => {
    it("lists saved themes in display order", async () => {
        const service = await build(mockEntityManager({ find: [ContentPillarEntity, [pillarRow()]] }))

        await expect(service.list("ws-1")).resolves.toEqual([
            {
                id: "pillar-1",
                workspaceId: "ws-1",
                name: "Menu",
                description: "Daily menu",
                weight: 2,
                sort: 0,
                active: true,
            },
        ])
    })

    it("lists nothing when the workspace has no themes", async () => {
        const service = await build(mockEntityManager({ find: [ContentPillarEntity, []] }))

        await expect(service.list("ws-1")).resolves.toEqual([])
    })

    it("answers which of the given ids are themes of the workspace", async () => {
        const em = mockEntityManager({ find: [ContentPillarEntity, [pillarRow()]] })
        const service = await build()

        await expect(service.known("ws-1", ["pillar-1", "ghost"], em)).resolves.toEqual(["pillar-1"])
        expect(em.find).toHaveBeenCalledWith(ContentPillarEntity, expect.objectContaining({ take: 100 }))
    })

    it("answers whether a theme exists, on the caller's transaction or on its own", async () => {
        const tx = mockEntityManager({ exists: [ContentPillarEntity, true] })
        const own = mockEntityManager({ exists: [ContentPillarEntity, false] })
        const service = await build(own)

        await expect(service.exists("ws-1", "pillar-1", tx)).resolves.toBe(true)
        await expect(service.exists("ws-1", "pillar-1")).resolves.toBe(false)
    })

    it("counts the active themes, all of them or among some ids", async () => {
        const em = mockEntityManager({ count: [ContentPillarEntity, 3] })
        const service = await build(em)

        await expect(service.countActive("ws-1")).resolves.toBe(3)
        await expect(service.countActiveAmong("ws-1", ["pillar-1"])).resolves.toBe(3)
        expect(namedCalls(em.count.mock.calls)).toEqual([
            ["ContentPillarEntity", { where: { workspaceId: "ws-1", active: true } }],
            ["ContentPillarEntity", { where: { workspaceId: "ws-1", active: true, id: In(["pillar-1"]) } }],
        ])
    })
}

const registerReplace = () => {
    it("replaces themes and trims their text inside the caller's transaction", async () => {
        const service = await build()
        const tx = mockEntityManager({
            delete: [ContentPillarEntity, { affected: 0 }],
            update: [ContentPillarEntity, { affected: 1 }],
        })
        const [saved] = queueQueryBuilders(tx, [{ execute: { raw: [] } }])

        await expect(service.replace(tx, "ws-1", paddedDrafts)).resolves.toBeUndefined()

        expect(namedCalls(tx.delete.mock.calls)).toEqual([["ContentPillarEntity", deleteExceptPillar1]])
        expect(namedCalls(tx.update.mock.calls, 2)).toEqual([
            ["ContentPillarEntity", { workspaceId: "ws-1", id: In(["pillar-1"]) }, { name: "function" }],
        ])
        expect(evaluatedValues(tx.update.mock.calls[0]?.[2])).toEqual({ name: "'edit:' || gen_random_uuid()::text" })
        expect(tx.createQueryBuilder).toHaveBeenCalledWith(ContentPillarEntity, "content_pillars")
        expect(saved?.callsOf("values")).toEqual([[paddedInserted]])
        expect(saved?.callsOf("setParameter")).toEqual([["workspaceId", "ws-1"]])
    })

    it("removes every theme when none is kept", async () => {
        const service = await build()
        const tx = mockEntityManager({
            delete: [ContentPillarEntity, { affected: 2 }],
        })

        await service.replace(tx, "ws-1", [])

        expect(namedCalls(tx.delete.mock.calls)).toEqual([["ContentPillarEntity", deleteAllOfWs1]])
        expect(tx.update).not.toHaveBeenCalled()
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
}

describe("ContentPillarsService", () => {
    registerReads()
    registerReplace()
})
