import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContentPillarDraft } from "./content-pillars.contracts"
import { ContentPillarsService } from "./content-pillars.service"
import { In, Not } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { entityRowBuilder, namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { ContentPillarEntity } from "./persistence/entities"

const pillarRow = entityRowBuilder<ContentPillarEntity>({
    id: "pillar-1",
    workspaceId: "ws-1",
    name: "Menu",
    description: "Daily menu",
    weight: 2,
    sort: 0,
    active: true,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** The rows the replace test expects the insert to carry: the kept theme, then the new one. */
const insertedOf = (changes: Partial<ContentPillarEntity>, omitted: ReadonlyArray<string> = []) =>
    Object.fromEntries(
        Object.entries(pillarRow(changes)).filter(([key]) => key !== "createdAt" && !omitted.includes(key)),
    )

const INSERTED = [
    insertedOf({ description: "Daily" }),
    insertedOf({ name: "New", description: "Fresh", weight: 1, sort: 1, active: false }, ["id"]),
]

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
}

const registerReplace = () => {
    it("replaces themes and trims their text inside the caller's transaction", async () => {
        const service = await build()
        const drafts: ReadonlyArray<ContentPillarDraft> = [
            { id: "pillar-1", name: " Menu ", description: " Daily ", weight: 2, active: true },
            { name: " New ", description: " Fresh ", weight: 1, active: false },
        ]
        const tx = mockEntityManager({
            delete: [ContentPillarEntity, { affected: 0 }],
            update: [ContentPillarEntity, { affected: 1 }],
        })
        const [saved] = queueQueryBuilders(tx, [{ execute: { raw: [] } }])

        await expect(service.replace(tx, "ws-1", drafts)).resolves.toBeUndefined()

        expect(tx.delete.mock.calls).toEqual([
            [ContentPillarEntity, { workspaceId: "ws-1", id: Not(In(["pillar-1"])) }],
        ])
        expect(namedCalls(tx.update.mock.calls, 2)).toEqual([
            ["ContentPillarEntity", { workspaceId: "ws-1", id: In(["pillar-1"]) }, { name: "function" }],
        ])
        expect(tx.createQueryBuilder).toHaveBeenCalledWith(ContentPillarEntity, "content_pillars")
        expect(saved?.callsOf("values")).toEqual([[INSERTED]])
        expect(saved?.callsOf("setParameter")).toEqual([["workspaceId", "ws-1"]])
    })

    it("removes every theme when none is kept", async () => {
        const service = await build()
        const tx = mockEntityManager({
            delete: [ContentPillarEntity, { affected: 2 }],
        })

        await service.replace(tx, "ws-1", [])

        expect(tx.delete.mock.calls).toEqual([[ContentPillarEntity, { workspaceId: "ws-1" }]])
        expect(tx.update).not.toHaveBeenCalled()
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
}

describe("ContentPillarsService", () => {
    registerReads()
    registerReplace()
})
