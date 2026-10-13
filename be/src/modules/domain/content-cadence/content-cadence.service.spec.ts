import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContentCadenceDraft } from "./content-cadence.contracts"
import { ContentCadenceService } from "./content-cadence.service"
import type { ContentCadenceRow } from "./persistence/content-cadence.rows"
import {
    DELETE_CONFIGURATION_CADENCE,
    SAVE_CONFIGURATION_CADENCE,
    SELECT_CONFIGURATION_CADENCE,
} from "./persistence/content-cadence.sql"

const row: ContentCadenceRow = {
    id: "cad-1",
    workspace_id: "ws-1",
    channel: "facebook",
    posts_per_week: 3,
    days: [1, 3],
    post_time: "09:00",
}

const build = async (rows: ReadonlyArray<ContentCadenceRow>) => {
    const entityManager = mockEntityManager({
        query: [
            [SELECT_CONFIGURATION_CADENCE, rows],
            [DELETE_CONFIGURATION_CADENCE, []],
            [SAVE_CONFIGURATION_CADENCE, []],
        ],
    })
    const moduleRef = await Test.createTestingModule({
        providers: [ContentCadenceService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(ContentCadenceService), entityManager }
}

describe("ContentCadenceService", () => {
    it("maps a stored rhythm onto the workspace view", async () => {
        const { service, entityManager } = await build([row])

        await expect(service.list("ws-1")).resolves.toEqual([
            {
                id: "cad-1",
                workspaceId: "ws-1",
                channel: "facebook",
                postsPerWeek: 3,
                days: [1, 3],
                time: "09:00",
            },
        ])
        expect(entityManager.query).toHaveBeenCalledWith(SELECT_CONFIGURATION_CADENCE, ["ws-1"])
    })

    it("reads an explicit transaction and answers nothing when the workspace has no rhythm", async () => {
        const { service, entityManager } = await build([])
        const transaction: EntityManager = mockEntityManager({ query: [SELECT_CONFIGURATION_CADENCE, []] })

        await expect(service.list("ws-1", transaction)).resolves.toEqual([])
        expect(entityManager.query).not.toHaveBeenCalled()
    })

    it("replaces the workspace rhythms with sorted unique weekdays", async () => {
        const { service, entityManager } = await build([])
        const draft: ContentCadenceDraft = { channel: "zalo", postsPerWeek: 4, days: [3, 1, 3], time: "18:30" }

        await service.replace(entityManager, "ws-1", [draft])

        expect(entityManager.query).toHaveBeenCalledWith(DELETE_CONFIGURATION_CADENCE, ["ws-1", ["zalo"]])
        expect(entityManager.query).toHaveBeenCalledWith(SAVE_CONFIGURATION_CADENCE, [
            "ws-1",
            JSON.stringify([{ channel: "zalo", posts_per_week: 4, days: [1, 3], post_time: "18:30" }]),
        ])
    })
})
