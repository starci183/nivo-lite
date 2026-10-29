import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { VideoDelegationEntity } from "./persistence/entities"
import { VideoDelegationsService } from "./video-delegations.service"

/** The any-function matcher, typed `unknown` so it flows into any slot. */
const anyFunction = (): unknown => expect.any(Function)

const ROW = { id: "delegation-1", project_id: "project-1" }
const ENTITY = Object.assign(new VideoDelegationEntity(), { id: "delegation-1", projectId: "project-1" })

const INPUT = {
    workspaceId: "workspace-1",
    workItemId: "item-1",
    projectId: "project-1",
    sourceModule: "content",
    contentItemId: null,
    channels: ["facebook"],
}

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [VideoDelegationsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(VideoDelegationsService)
}

describe("VideoDelegationsService > reads", () => {
    it("answers the delegation of a work item", async () => {
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, ENTITY] })

        await expect((await build(em)).ofWorkItem("workspace-1", "item-1")).resolves.toEqual(ROW)
        expect(em.findOne).toHaveBeenCalledWith(VideoDelegationEntity, {
            select: { id: true, projectId: true },
            where: { workspaceId: "workspace-1", workItemId: "item-1" },
        })
    })

    it("answers null for a work item that made none", async () => {
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, null] })

        await expect((await build(em)).ofWorkItem("workspace-1", "item-1")).resolves.toBeNull()
    })

    it("answers the delegation of a settled render", async () => {
        const read = fakeQueryBuilder({ getRawOne: ROW })
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(read.builder as never)

        await expect((await build(em)).ofSettledRender("render-1")).resolves.toEqual(ROW)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(VideoDelegationEntity, "d")
        expect(read.callsOf("innerJoin")).toHaveLength(2)
        expect(read.callsOf("where")).toEqual([["d.render_id = :renderId", { renderId: "render-1" }]])
        expect(read.callsOf("andWhere")).toEqual([
            ["d.status = :rendering", { rendering: "rendering" }],
            ["r.status IN (:...settled)", { settled: ["done", "failed"] }],
        ])
        expect(read.callsOf("limit")).toEqual([[1]])
    })

    it("answers null for a render nobody delegated", async () => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getRawOne: undefined }).builder as never)

        await expect((await build(em)).ofSettledRender("render-1")).resolves.toBeNull()
    })
})

describe("VideoDelegationsService > writes", () => {
    it("records a delegation in the caller's transaction", async () => {
        const tx = mockEntityManager({
            insert: [VideoDelegationEntity, { identifiers: [{ id: "delegation-1" }], generatedMaps: [], raw: [] }],
        })

        await expect((await build(mockEntityManager())).record(tx, INPUT)).resolves.toEqual(ROW)
        expect(tx.insert).toHaveBeenCalledWith(VideoDelegationEntity, {
            workspaceId: "workspace-1",
            workItemId: "item-1",
            projectId: "project-1",
            sourceModule: "content",
            contentItemId: null,
            channels: ["facebook"],
        })
    })

    it("answers null when the delegation was not written", async () => {
        const tx = mockEntityManager({
            insert: [VideoDelegationEntity, { identifiers: [], generatedMaps: [], raw: [] }],
        })

        await expect((await build(mockEntityManager())).record(tx, INPUT)).resolves.toBeNull()
    })

    it("links the queued render", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        await (await build(em)).linkRender("delegation-1", "render-1")

        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1" },
            { renderId: "render-1", updatedAt: anyFunction() },
        )
    })

    it("keeps the posted card as JSON", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        await (await build(em)).saveCard("delegation-1", "approval-1", { v: 1 })

        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1" },
            { approvalWorkItemId: "approval-1", card: { v: 1 }, updatedAt: anyFunction() },
        )
    })

    it("answers true for the call that settled the delegation", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        await expect((await build(em)).markFailed("delegation-1", "boom")).resolves.toBe(true)
        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1", status: "rendering" },
            { status: "failed", error: "boom", updatedAt: anyFunction() },
        )
    })

    it("answers false once the delegation was settled", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 0 }] })

        await expect((await build(em)).markReady("delegation-1")).resolves.toBe(false)
    })
})
