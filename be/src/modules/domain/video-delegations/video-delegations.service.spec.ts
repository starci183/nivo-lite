import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    FIND_DELEGATION_OF_ITEM,
    FIND_DELEGATION_OF_RENDER,
    INSERT_DELEGATION,
    SAVE_DELEGATION_CARD,
    SETTLE_DELEGATION,
    SET_DELEGATION_RENDER,
} from "./persistence/video-delegations.sql"
import { VideoDelegationsService } from "./video-delegations.service"

const ROW = { id: "delegation-1", project_id: "project-1" }

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
        const em = mockEntityManager({ query: [FIND_DELEGATION_OF_ITEM, [ROW]] })

        await expect((await build(em)).ofWorkItem("workspace-1", "item-1")).resolves.toEqual(ROW)
        expect(em.query).toHaveBeenCalledWith(FIND_DELEGATION_OF_ITEM, ["workspace-1", "item-1"])
    })

    it("answers null for a work item that made none", async () => {
        const em = mockEntityManager({ query: [FIND_DELEGATION_OF_ITEM, []] })

        await expect((await build(em)).ofWorkItem("workspace-1", "item-1")).resolves.toBeNull()
    })

    it("answers the delegation of a settled render", async () => {
        const em = mockEntityManager({ query: [FIND_DELEGATION_OF_RENDER, [ROW]] })

        await expect((await build(em)).ofSettledRender("render-1")).resolves.toEqual(ROW)
        expect(em.query).toHaveBeenCalledWith(FIND_DELEGATION_OF_RENDER, ["render-1"])
    })

    it("answers null for a render nobody delegated", async () => {
        const em = mockEntityManager({ query: [FIND_DELEGATION_OF_RENDER, []] })

        await expect((await build(em)).ofSettledRender("render-1")).resolves.toBeNull()
    })
})

describe("VideoDelegationsService > writes", () => {
    it("records a delegation in the caller's transaction", async () => {
        const tx = mockEntityManager({ query: [INSERT_DELEGATION, [ROW]] })

        await expect((await build(mockEntityManager())).record(tx, INPUT)).resolves.toEqual(ROW)
        expect(tx.query).toHaveBeenCalledWith(INSERT_DELEGATION, [
            "workspace-1",
            "item-1",
            "project-1",
            "content",
            null,
            ["facebook"],
        ])
    })

    it("answers null when the delegation was not written", async () => {
        const tx = mockEntityManager({ query: [INSERT_DELEGATION, []] })

        await expect((await build(mockEntityManager())).record(tx, INPUT)).resolves.toBeNull()
    })

    it("links the queued render", async () => {
        const em = mockEntityManager({ query: [SET_DELEGATION_RENDER, []] })

        await (await build(em)).linkRender("delegation-1", "render-1")

        expect(em.query).toHaveBeenCalledWith(SET_DELEGATION_RENDER, ["delegation-1", "render-1"])
    })

    it("keeps the posted card as JSON", async () => {
        const em = mockEntityManager({ query: [SAVE_DELEGATION_CARD, []] })

        await (await build(em)).saveCard("delegation-1", "approval-1", { v: 1 })

        expect(em.query).toHaveBeenCalledWith(SAVE_DELEGATION_CARD, ["delegation-1", "approval-1", '{"v":1}'])
    })

    it("answers true for the call that settled the delegation", async () => {
        const em = mockEntityManager({ query: [SETTLE_DELEGATION, [ROW]] })

        await expect((await build(em)).markFailed("delegation-1", "boom")).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(SETTLE_DELEGATION, ["delegation-1", "failed", "boom"])
    })

    it("answers false once the delegation was settled", async () => {
        const em = mockEntityManager({ query: [SETTLE_DELEGATION, []] })

        await expect((await build(em)).markReady("delegation-1")).resolves.toBe(false)
    })
})
