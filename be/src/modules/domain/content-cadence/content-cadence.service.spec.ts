import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import type { ContentCadenceDraft } from "./content-cadence.contracts"
import { ContentCadenceService } from "./content-cadence.service"
import { ContentCadenceEntity } from "./persistence/entities"

const row = entityRowBuilder<ContentCadenceEntity>({
    id: "cad-1",
    workspaceId: "ws-1",
    channel: "facebook",
    postsPerWeek: 3,
    days: [1, 3],
    postTime: "09:00",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    updatedAt: new Date("2026-10-13T02:00:00.000Z"),
})()

const build = async (rows: ReadonlyArray<ContentCadenceEntity>) => {
    const entityManager = mockEntityManager({
        find: [ContentCadenceEntity, rows],
        delete: [ContentCadenceEntity, { affected: 0 }],
        upsert: [ContentCadenceEntity, {}],
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
        expect(entityManager.find).toHaveBeenCalledWith(ContentCadenceEntity, {
            where: { workspaceId: "ws-1" },
            order: { channel: "ASC" },
            take: 4,
        })
    })

    it("reads an explicit transaction and answers nothing when the workspace has no rhythm", async () => {
        const { service, entityManager } = await build([])
        const transaction: EntityManager = mockEntityManager({ find: [ContentCadenceEntity, []] })

        await expect(service.list("ws-1", transaction)).resolves.toEqual([])
        expect(entityManager.find).not.toHaveBeenCalled()
    })

    it("replaces the workspace rhythms with sorted unique weekdays", async () => {
        const { service, entityManager } = await build([])
        const draft: ContentCadenceDraft = { channel: "zalo", postsPerWeek: 4, days: [3, 1, 3], time: "18:30" }

        await service.replace(entityManager, "ws-1", [draft])

        expect(entityManager.delete).toHaveBeenCalledWith(ContentCadenceEntity, {
            workspaceId: "ws-1",
            channel: Not(In(["zalo"])),
        })
        expect(entityManager.upsert).toHaveBeenCalledWith(
            ContentCadenceEntity,
            [{ workspaceId: "ws-1", channel: "zalo", postsPerWeek: 4, days: [1, 3], postTime: "18:30" }],
            ["workspaceId", "channel"],
        )
    })

    it("only removes the rhythms left out when the replacement is empty", async () => {
        const { service, entityManager } = await build([])

        await service.replace(entityManager, "ws-1", [])

        expect(entityManager.delete).toHaveBeenCalledWith(ContentCadenceEntity, {
            workspaceId: "ws-1",
            channel: Not(In([])),
        })
        expect(entityManager.upsert).not.toHaveBeenCalled()
    })
})
