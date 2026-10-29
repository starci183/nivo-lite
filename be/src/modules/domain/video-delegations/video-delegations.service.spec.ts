import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { SettledRender } from "@modules/domain/video-renders"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
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

/** What the last update stamped as the change time. */
const stamped = (em: MockEntityManager): string => {
    return writeExpressionOf(em.update.mock.calls.at(-1)?.[2], "updatedAt") ?? ""
}

const SETTLED: SettledRender = {
    id: "render-1",
    status: "done",
    durationMs: 15_000,
    outputPath: "workspace-1/render-1/video.mp4",
    posterPath: "workspace-1/render-1/poster.jpg",
    captionsPath: "workspace-1/render-1/captions.vtt",
    captionsLang: "vi",
    voiceover: "tts",
    error: null,
}

const build = async (em: MockEntityManager) => {
    const projects = mock<VideoProjectsService>()
    const renders = mock<VideoRendersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoDelegationsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: VideoProjectsService, useValue: projects },
            { provide: VideoRendersService, useValue: renders },
        ],
    }).compile()
    return { service: moduleRef.get(VideoDelegationsService), projects, renders }
}

describe("VideoDelegationsService > reads", () => {
    it("answers the delegation of a work item", async () => {
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, ENTITY] })

        const { service } = await build(em)

        await expect(service.ofWorkItem("workspace-1", "item-1")).resolves.toEqual(ROW)
        expect(em.findOne).toHaveBeenCalledWith(VideoDelegationEntity, {
            select: { id: true, projectId: true },
            where: { workspaceId: "workspace-1", workItemId: "item-1" },
        })
    })

    it("answers null for a work item that made none", async () => {
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, null] })

        const { service } = await build(em)

        await expect(service.ofWorkItem("workspace-1", "item-1")).resolves.toBeNull()
    })

})

describe("VideoDelegationsService > settled renders", () => {
    it("answers the delegation of a settled render with its project and render", async () => {
        const delegation = Object.assign(new VideoDelegationEntity(), {
            id: "delegation-1",
            workspaceId: "workspace-1",
            workItemId: "item-1",
            projectId: "project-1",
            sourceModule: "content",
            channels: ["facebook"],
        })
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, delegation] })
        const { service, projects, renders } = await build(em)
        projects.cardFactsOf.mockResolvedValue({ title: "Offer", aspect: "9:16", script: [{ caption: "A" }] })
        renders.settledOf.mockResolvedValue(SETTLED)

        await expect(service.ofSettledRender("render-1")).resolves.toEqual({
            id: "delegation-1",
            workspace_id: "workspace-1",
            work_item_id: "item-1",
            project_id: "project-1",
            source_module: "content",
            channels: ["facebook"],
            title: "Offer",
            aspect: "9:16",
            script: [{ caption: "A" }],
            render_id: "render-1",
            render_status: "done",
            duration_ms: 15_000,
            output_path: "workspace-1/render-1/video.mp4",
            poster_path: "workspace-1/render-1/poster.jpg",
            captions_path: "workspace-1/render-1/captions.vtt",
            captions_lang: "vi",
            voiceover: "tts",
            error: null,
        })
        expect(em.findOne).toHaveBeenCalledWith(VideoDelegationEntity, {
            select: {
                id: true,
                workspaceId: true,
                workItemId: true,
                projectId: true,
                sourceModule: true,
                channels: true,
            },
            where: { renderId: "render-1", status: "rendering" },
        })
        expect(projects.cardFactsOf).toHaveBeenCalledWith("workspace-1", "project-1")
        expect(renders.settledOf).toHaveBeenCalledWith("workspace-1", "render-1")
    })

    it("answers null for a render nobody delegated", async () => {
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, null] })
        const { service, renders } = await build(em)

        await expect(service.ofSettledRender("render-1")).resolves.toBeNull()
        expect(renders.settledOf).not.toHaveBeenCalled()
    })

    it.each([
        ["a project that is gone", null, SETTLED],
        ["a render that is still open", { title: "Offer", aspect: "9:16", script: [] }, null],
    ])("answers null for %s", async (_label, project, render) => {
        const delegation = Object.assign(new VideoDelegationEntity(), {
            id: "delegation-1",
            workspaceId: "workspace-1",
            workItemId: "item-1",
            projectId: "project-1",
            sourceModule: "content",
            channels: [],
        })
        const em = mockEntityManager({ findOne: [VideoDelegationEntity, delegation] })
        const { service, projects, renders } = await build(em)
        projects.cardFactsOf.mockResolvedValue(project)
        renders.settledOf.mockResolvedValue(render)

        await expect(service.ofSettledRender("render-1")).resolves.toBeNull()
    })
})

describe("VideoDelegationsService > writes", () => {
    it("records a delegation in the caller's transaction", async () => {
        const tx = mockEntityManager({
            insert: [VideoDelegationEntity, { identifiers: [{ id: "delegation-1" }], generatedMaps: [], raw: [] }],
        })

        const { service } = await build(mockEntityManager())

        await expect(service.record(tx, INPUT)).resolves.toEqual(ROW)
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

        const { service } = await build(mockEntityManager())

        await expect(service.record(tx, INPUT)).resolves.toBeNull()
    })

    it("links the queued render", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        const { service } = await build(em)

        await service.linkRender("delegation-1", "render-1")

        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1" },
            { renderId: "render-1", updatedAt: anyFunction() },
        )
        expect(stamped(em)).toBe("now()")
    })

    it("keeps the posted card as JSON", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        const { service } = await build(em)

        await service.saveCard("delegation-1", "approval-1", { v: 1 })

        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1" },
            { approvalWorkItemId: "approval-1", card: { v: 1 }, updatedAt: anyFunction() },
        )
        expect(stamped(em)).toBe("now()")
    })

})

describe("VideoDelegationsService > settling", () => {
    it("answers true for the call that settled the delegation", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 1 }] })

        const { service } = await build(em)

        await expect(service.markFailed("delegation-1", "boom")).resolves.toBe(true)
        expect(em.update).toHaveBeenCalledWith(
            VideoDelegationEntity,
            { id: "delegation-1", status: "rendering" },
            { status: "failed", error: "boom", updatedAt: anyFunction() },
        )
        expect(stamped(em)).toBe("now()")
    })

    it("answers false once the delegation was settled", async () => {
        const em = mockEntityManager({ update: [VideoDelegationEntity, { affected: 0 }] })

        const { service } = await build(em)

        await expect(service.markReady("delegation-1")).resolves.toBe(false)

        const unreported = await build(mockEntityManager({ update: [VideoDelegationEntity, {}] }))
        await expect(unreported.service.markReady("delegation-1")).resolves.toBe(false)
    })
})
