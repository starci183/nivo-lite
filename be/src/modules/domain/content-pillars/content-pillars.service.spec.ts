import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContentPillarDraft } from "./content-pillars.contracts"
import { ContentPillarsService } from "./content-pillars.service"
import type { ContentPillarRow } from "./persistence/content-pillars.rows"
import {
    DELETE_CONFIGURATION_PILLARS,
    SAVE_CONFIGURATION_PILLARS,
    SELECT_CONFIGURATION_PILLARS,
    STAGE_CONFIGURATION_PILLAR_NAMES,
} from "./persistence/content-pillars.sql"

const ROW: ContentPillarRow = {
    id: "pillar-1",
    workspace_id: "ws-1",
    name: "Menu",
    description: "Daily menu",
    weight: 2,
    sort: 0,
    active: true,
}

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentPillarsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContentPillarsService)
}

describe("ContentPillarsService", () => {
    it("lists saved themes in display order", async () => {
        const service = await build(mockEntityManager({ query: [SELECT_CONFIGURATION_PILLARS, [ROW]] }))

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
        const service = await build(mockEntityManager({ query: [SELECT_CONFIGURATION_PILLARS, []] }))

        await expect(service.list("ws-1")).resolves.toEqual([])
    })

    it("replaces themes and trims their text inside the caller's transaction", async () => {
        const service = await build()
        const drafts: ReadonlyArray<ContentPillarDraft> = [
            { id: "pillar-1", name: " Menu ", description: " Daily ", weight: 2, active: true },
            { name: " New ", description: " Fresh ", weight: 1, active: false },
        ]
        const tx = mockEntityManager({
            query: [
                [DELETE_CONFIGURATION_PILLARS, []],
                [STAGE_CONFIGURATION_PILLAR_NAMES, []],
                [SAVE_CONFIGURATION_PILLARS, []],
            ],
        })

        await expect(service.replace(tx, "ws-1", drafts)).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenNthCalledWith(1, DELETE_CONFIGURATION_PILLARS, ["ws-1", ["pillar-1"]])
        expect(tx.query).toHaveBeenNthCalledWith(2, STAGE_CONFIGURATION_PILLAR_NAMES, ["ws-1", ["pillar-1"]])
        expect(tx.query).toHaveBeenNthCalledWith(3, SAVE_CONFIGURATION_PILLARS, [
            "ws-1",
            JSON.stringify([
                {
                    id: "pillar-1",
                    name: "Menu",
                    description: "Daily",
                    weight: 2,
                    active: true,
                    sort: 0,
                },
                { name: "New", description: "Fresh", weight: 1, active: false, sort: 1 },
            ]),
        ])
    })
})
