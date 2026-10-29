import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ILike, In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { ResponsibilityEntity } from "./persistence/entities"
import { ResponsibilityReadService } from "./responsibility-read.service"

const stepOf = entityOf(ResponsibilityEntity, {
    id: "r1",
    workspaceId: "ws-1",
    leadId: "l1",
    title: "Call back",
    ownerKind: "agent",
    ownerAgentId: "a1",
    ownerMemberId: null,
    ownerName: "Sales",
    nextAction: "Call",
    dueAt: null,
    status: "open",
    createdAt: new Date("2026-10-12T03:00:00.000Z"),
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ResponsibilityReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ResponsibilityReadService)
}

describe("ResponsibilityReadService", () => {
    it("asks for no step when no id is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).stepsOf("ws-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("reads the given steps of the workspace once each", async () => {
        const em = mockEntityManager({ find: [ResponsibilityEntity, [stepOf()]] })

        await expect((await build(em)).stepsOf("ws-1", ["r1", "r1"])).resolves.toEqual([
            expect.objectContaining({ id: "r1", leadId: "l1", ownerName: "Sales", nextAction: "Call" }),
        ])
        expect(em.find).toHaveBeenCalledWith(ResponsibilityEntity, {
            where: { workspaceId: "ws-1", id: In(["r1"]) },
            take: 1,
        })
    })

    it("lists the steps due soonest first with the undated last, bounded", async () => {
        const em = mockEntityManager({ find: [ResponsibilityEntity, [stepOf()]] })

        await expect((await build(em)).dueSoonest("ws-1", 2000)).resolves.toEqual([
            {
                id: "r1",
                leadId: "l1",
                title: "Call back",
                ownerKind: "agent",
                ownerAgentId: "a1",
                ownerName: "Sales",
                nextAction: "Call",
                dueAt: null,
                status: "open",
                createdAt: new Date("2026-10-12T03:00:00.000Z"),
            },
        ])
        expect(em.find).toHaveBeenCalledWith(ResponsibilityEntity, {
            where: { workspaceId: "ws-1" },
            order: { dueAt: { direction: "ASC", nulls: "LAST" } },
            take: 2000,
        })
    })

    it("answers the customer of each given step and asks nothing for no steps", async () => {
        const em = mockEntityManager({ find: [ResponsibilityEntity, [stepOf()]] })
        const service = await build(em)

        await expect(service.leadsOf("ws-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(service.leadsOf("ws-1", ["r1", "r1"])).resolves.toEqual([{ id: "r1", leadId: "l1" }])
        expect(em.find).toHaveBeenCalledWith(ResponsibilityEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId: "ws-1", id: In(["r1"]) },
            order: { id: "ASC" },
            take: 1,
        })
    })

    it("answers the ids of the steps titled like any pattern and asks nothing for no pattern", async () => {
        const em = mockEntityManager({ find: [ResponsibilityEntity, [stepOf()]] })
        const service = await build(em)

        await expect(service.idsTitledLike("ws-1", [], 10)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(
            service.idsTitledLike("ws-1", ["Prepare invoice%", "Chu\u1ea9n b\u1ecb h\u00f3a \u0111\u01a1n%"], 10),
        ).resolves.toEqual(["r1"])
        expect(em.find).toHaveBeenCalledWith(ResponsibilityEntity, {
            select: { id: true },
            where: [
                { workspaceId: "ws-1", title: ILike("Prepare invoice%") },
                { workspaceId: "ws-1", title: ILike("Chu\u1ea9n b\u1ecb h\u00f3a \u0111\u01a1n%") },
            ],
            take: 10,
        })
    })
})
