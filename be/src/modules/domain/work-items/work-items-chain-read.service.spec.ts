import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsChainReadService } from "./work-items-chain-read.service"

const itemOf = entityOf(WorkItemEntity, { id: "w-1", chainId: "c-1", depth: 2 })

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsChainReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(WorkItemsChainReadService)
}

describe("WorkItemsChainReadService", () => {
    it("tells where an item sits in its chain, null for no such item", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, itemOf()] })
        const service = await build(em)

        await expect(service.spotOf("ws-1", "w-1")).resolves.toEqual({ id: "w-1", chainId: "c-1", depth: 2 })
        const other = mockEntityManager({ findOne: [WorkItemEntity, null] })
        await expect(service.spotOf("ws-1", "w-9", other)).resolves.toBeNull()
    })

    it("tells how deep a chain goes, null for an empty chain", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, itemOf()] })
        const service = await build(em)

        await expect(service.topDepth("ws-1", "c-1")).resolves.toBe(2)
        await expect(service.topDepth("ws-1", "c-9", mockEntityManager({ findOne: [WorkItemEntity, null] }))).resolves.toBeNull()
    })

    it("asks whether the chain already ran the action on the subject, with or without a subject", async () => {
        const em = mockEntityManager({ exists: [WorkItemEntity, true] })
        const service = await build(em)
        const query = {
            workspaceId: "ws-1",
            chainId: "c-1",
            action: "send_care",
            subjectType: "lead",
            subjectId: "l-1",
            dedupeKey: "k-1",
        } as const

        await expect(service.repeats(query)).resolves.toBe(true)
        await service.repeats({ ...query, subjectId: null })
        expect(em.exists).toHaveBeenNthCalledWith(1, WorkItemEntity, {
            where: { workspaceId: "ws-1", chainId: "c-1", action: "send_care", subjectType: "lead", dedupeKey: Not("k-1"), subjectId: "l-1" },
        })
        expect(em.exists).toHaveBeenNthCalledWith(2, WorkItemEntity, {
            where: expect.objectContaining({ subjectId: IsNull() }),
        })
    })
})
