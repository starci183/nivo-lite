import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager, QueryBuilderAnswers } from "@starci/jest-preset"
import { In, LessThanOrEqual } from "typeorm"
import { COMPLETED_MEDIA, COMPLETED_MEDIA_ROWS, DONE_RENDER, NEW_RENDER } from "@tests/fixtures/builders/video-renders.builder"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoRendersErrorCode } from "./errors/video-renders.error"
import { VideoRenderEntity } from "./persistence/entities"
import { VideoRendersService } from "./video-renders.service"

/** The any-function matcher, typed `unknown` so it flows into any slot. */
const anyFunction = (): unknown => expect.any(Function)

const OPEN = ["queued", "rendering"]

const build = async (entityManager: MockEntityManager) => {
    const projects = mock<VideoProjectsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoRendersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: VideoProjectsService, useValue: projects },
        ],
    }).compile()
    return { renders: moduleRef.get(VideoRendersService), projects }
}

/** A manager whose query builder answers `answers`, with the calls recorded on the builder. */
const readerOf = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const [fake] = queueQueryBuilders(em, [answers])
    return { em, callsOf: (method: string) => fake?.callsOf(method) ?? [] }
}

const inserted = (id?: string) => ({
    identifiers: id === undefined ? [] : [{ id }],
    generatedMaps: [],
    raw: [],
})

describe("VideoRendersService > open", () => {
    it("writes a queued render for a workspace that has room and answers its id", async () => {
        const manager = mockEntityManager({
            count: [VideoRenderEntity, 2],
            insert: [VideoRenderEntity, inserted("render-1")],
        })
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, NEW_RENDER)).resolves.toBe("render-1")

        expect(manager.count).toHaveBeenCalledWith(VideoRenderEntity, {
            where: { workspaceId: "workspace-1", status: In(OPEN) },
        })
        expect(manager.insert).toHaveBeenCalledWith(VideoRenderEntity, {
            workspaceId: "workspace-1",
            spec: { version: 1 },
            createdBy: "person-1",
        })
    })

    it("refuses a workspace that already has the most open renders", async () => {
        const manager = mockEntityManager({ count: [VideoRenderEntity, 3] })
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, NEW_RENDER)).rejects.toMatchObject({
            code: VideoRendersErrorCode.TooMany,
            params: { workspaceId: "workspace-1" },
        })
        expect(manager.insert).not.toHaveBeenCalled()
    })

    it("counts a workspace with no open renders as having room", async () => {
        const manager = mockEntityManager({
            count: [VideoRenderEntity, 0],
            insert: [VideoRenderEntity, inserted("render-1")],
        })
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, NEW_RENDER)).resolves.toBe("render-1")
    })

    it("refuses a spec that is not JSON before touching the database", async () => {
        const manager = mockEntityManager()
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, { ...NEW_RENDER, spec: "{not json" })).rejects.toMatchObject({
            code: VideoRendersErrorCode.JsonUnreadable,
        })
        expect(manager.count).not.toHaveBeenCalled()
        expect(manager.insert).not.toHaveBeenCalled()
    })

    it.each(["5", "null"])("refuses a spec that is JSON but not a document (%s)", async (spec) => {
        const manager = mockEntityManager()
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, { ...NEW_RENDER, spec })).rejects.toMatchObject({
            code: VideoRendersErrorCode.JsonUnreadable,
        })
    })

    it("refuses when the insert answers no row", async () => {
        const manager = mockEntityManager({
            count: [VideoRenderEntity, 0],
            insert: [VideoRenderEntity, inserted()],
        })
        const { renders } = await build(mockEntityManager())

        await expect(renders.open(manager, NEW_RENDER)).rejects.toMatchObject({
            code: VideoRendersErrorCode.NotWritten,
        })
    })
})

describe("VideoRendersService > claim", () => {
    it("answers the render a delivery takes", async () => {
        const update = readerOf({
            execute: {
                raw: [{ id: "render-1", workspace_id: "workspace-1", spec: { version: 1 }, meta: { attempts: 2 } }],
            },
        })
        const em = update.em
        const { renders } = await build(em)

        await expect(renders.claim("render-1")).resolves.toEqual({
            renderId: "render-1",
            workspaceId: "workspace-1",
            spec: { version: 1 },
            attempts: 2,
        })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(VideoRenderEntity, "v")
        expect(update.callsOf("update")).toEqual([[]])
        expect(update.callsOf("where")).toEqual([
            ["id = :renderId AND status IN (:...open)", { renderId: "render-1", open: OPEN }],
        ])
        expect(update.callsOf("returning")).toEqual([[["id", "workspace_id", "spec", "meta"]]])
        const set = update.callsOf("set")[0]?.[0]
        expect(set).toMatchObject({ status: "rendering", error: null, startedAt: anyFunction(), meta: anyFunction() })
        expect(writeExpressionOf(set, "startedAt")).toBe("COALESCE(started_at, now())")
        expect(writeExpressionOf(set, "meta")).toContain("jsonb_set(meta, '{attempts}'")
    })

    it("answers nothing when the database answers something that is not rows", async () => {
        const { renders } = await build(readerOf({ execute: { raw: "none" } }).em)

        await expect(renders.claim("render-1")).resolves.toBeNull()
    })

    it("answers nothing for a render that is already settled", async () => {
        const { renders } = await build(readerOf({ execute: { raw: [] } }).em)

        await expect(renders.claim("render-1")).resolves.toBeNull()
    })
})

describe("VideoRendersService > reportProgress", () => {
    it.each([
        [41.6, 42],
        [150, 99],
        [-5, 0],
    ])("records %s percent as %s", async (percent, stored) => {
        const em = mockEntityManager({ update: [VideoRenderEntity, { affected: 1 }] })
        const { renders } = await build(em)

        await renders.reportProgress("render-1", percent, "scenes")

        expect(em.update).toHaveBeenCalledWith(
            VideoRenderEntity,
            { id: "render-1", status: In(OPEN), progress: LessThanOrEqual(stored) },
            { status: "rendering", progress: stored, stage: "scenes" },
        )
    })
})

describe("VideoRendersService > complete and fail", () => {
    it("settles a render as done in the caller's transaction", async () => {
        const update = readerOf({ execute: { raw: [] } })
        const manager = update.em
        const { renders } = await build(mockEntityManager())

        await renders.complete(manager, "render-1", DONE_RENDER)

        expect(update.callsOf("set")[0]?.[0]).toMatchObject({
            status: "done",
            progress: 100,
            stage: null,
            outputPath: "w/r/video.mp4",
            posterPath: "w/r/poster.jpg",
            durationMs: 12000,
            sizeBytes: "345",
            error: null,
        })
        expect(update.callsOf("where")).toEqual([
            ["id = :renderId AND status IN (:...open)", { renderId: "render-1", open: OPEN }],
        ])
        expect(update.callsOf("setParameter")).toEqual([["report", '{"fps":30}']])
        const settled = update.callsOf("set")[0]?.[0]
        expect(writeExpressionOf(settled, "meta")).toBe("meta || CAST(:report AS jsonb)")
        expect(writeExpressionOf(settled, "finishedAt")).toBe("now()")
    })

    it("settles a render as failed in the caller's transaction", async () => {
        const update = readerOf({ execute: { raw: [] } })
        const manager = update.em
        const { renders } = await build(mockEntityManager())

        await renders.fail(manager, "render-1", "boom")

        const failed = update.callsOf("set")[0]?.[0]
        expect(failed).toMatchObject({ status: "failed", error: anyFunction() })
        expect(writeExpressionOf(failed, "error")).toBe("left(:reason, 300)")
        expect(writeExpressionOf(failed, "finishedAt")).toBe("now()")
        expect(update.callsOf("setParameter")).toEqual([["reason", "boom"]])
        expect(update.callsOf("where")).toEqual([
            ["id = :renderId AND status IN (:...open)", { renderId: "render-1", open: OPEN }],
        ])
    })
})

describe("VideoRendersService > getStatus", () => {
    it.each([
        ["queued", "queued", null, null, null, null, null],
        ["rendering", "running", "encode", "encode", "2048", 2048, null],
        ["done", "succeeded", "legacy-provider-stage", null, "4096", 4096, null],
        ["failed", "failed", "upload", "upload", null, null, "VIDEO_RENDER_FAILED"],
    ])(
        "maps %s to the public render lifecycle",
        async (status, expected, stage, expectedStage, size, expectedSize, errorCode) => {
            const em = mockEntityManager({
                findOne: [
                    VideoRenderEntity,
                    Object.assign(new VideoRenderEntity(), {
                        id: "render-1",
                        status,
                        progress: 76,
                        stage,
                        outputPath: "workspace-1/render-1/video.mp4",
                        posterPath: "workspace-1/render-1/poster.jpg",
                        durationMs: 12000,
                        sizeBytes: size,
                    }),
                ],
            })
            const { renders } = await build(em)

            await expect(renders.getStatus("workspace-1", "render-1")).resolves.toEqual({
                id: "render-1",
                status: expected,
                progress: 76,
                stage: expectedStage,
                outputPath: "workspace-1/render-1/video.mp4",
                posterPath: "workspace-1/render-1/poster.jpg",
                durationMs: 12000,
                sizeBytes: expectedSize,
                errorCode,
            })
            expect(em.findOne).toHaveBeenCalledWith(
                VideoRenderEntity,
                expect.objectContaining({ where: { workspaceId: "workspace-1", id: "render-1" } }),
            )
        },
    )

    it("refuses an unavailable workspace render", async () => {
        const { renders } = await build(mockEntityManager({ findOne: [VideoRenderEntity, null] }))

        await expect(renders.getStatus("workspace-1", "missing")).rejects.toMatchObject({
            code: VideoRendersErrorCode.NotFound,
            params: { renderId: "missing" },
        })
    })
})

describe("VideoRendersService > completed media", () => {
    /** A service whose projects owner names a title for the first render only. */
    const buildTitling = async (em: MockEntityManager) => {
        const built = await build(em)
        built.projects.titlesOfRenders.mockResolvedValue([{ renderId: "render-1", title: "Offer" }])
        return built
    }

    it("lists ten completed media by default, titled by project, then brand, then empty", async () => {
        const read = readerOf({ getRawMany: COMPLETED_MEDIA_ROWS })
        const em = read.em
        const { renders, projects } = await buildTitling(em)

        await expect(renders.listCompletedMedia("workspace-1")).resolves.toEqual(COMPLETED_MEDIA)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(VideoRenderEntity, "r")
        expect(read.callsOf("addSelect")).toContainEqual(["r.spec #>> '{brand,name}'", "brand_name"])
        expect(read.callsOf("where")).toEqual([["r.workspaceId = :workspaceId", { workspaceId: "workspace-1" }]])
        expect(read.callsOf("andWhere")).toEqual([
            ["r.status = :done", { done: "done" }],
            ["r.outputPath IS NOT NULL"],
        ])
        expect(read.callsOf("limit")).toEqual([[10]])
        expect(projects.titlesOfRenders).toHaveBeenCalledWith("workspace-1", ["render-1", "render-2", "render-3"])
    })

    it.each([
        [-2, 1],
        [12.9, 12],
        [101, 100],
    ])("bounds a requested limit of %s to %s", async (limit, expected) => {
        const read = readerOf({ getRawMany: [] })
        const { renders, projects } = await build(read.em)
        projects.titlesOfRenders.mockResolvedValue([])

        await expect(renders.listCompletedMedia("workspace-1", limit)).resolves.toEqual([])
        expect(read.callsOf("limit")).toEqual([[expected]])
    })

    it("does not query when no completed media were selected", async () => {
        const em = mockEntityManager()
        const { renders } = await build(em)

        await expect(renders.findCompletedMedia("workspace-1", [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("deduplicates and caps selected ids before mapping the completed media", async () => {
        const read = readerOf({ getRawMany: COMPLETED_MEDIA_ROWS })
        const { renders } = await buildTitling(read.em)
        const ids = Array.from({ length: 81 }, (_entry, index) => `render-${index + 1}`)

        await expect(renders.findCompletedMedia("workspace-1", ["render-1", ...ids])).resolves.toEqual(COMPLETED_MEDIA)
        expect(read.callsOf("andWhere")).toContainEqual(["r.id IN (:...ids)", { ids: ids.slice(0, 80) }])
        expect(read.callsOf("limit")).toEqual([[80]])
    })
})

describe("VideoRendersService > stateOf and isDone", () => {
    it("answers the raw status of a render, or null without one", async () => {
        const em = mockEntityManager({
            findOne: [
                [VideoRenderEntity, Object.assign(new VideoRenderEntity(), { status: "rendering" })],
                [VideoRenderEntity, null],
            ],
        })
        const { renders } = await build(em)

        await expect(renders.stateOf("render-1")).resolves.toBe("rendering")
        await expect(renders.stateOf("missing")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(VideoRenderEntity, {
            select: { status: true },
            where: { id: "render-1" },
        })
    })

    it("asks whether a render of the workspace is done", async () => {
        const em = mockEntityManager()
        em.exists.mockResolvedValue(true)
        const { renders } = await build(em)

        await expect(renders.isDone("workspace-1", "render-1")).resolves.toBe(true)
        expect(em.exists).toHaveBeenCalledWith(VideoRenderEntity, {
            where: { id: "render-1", workspaceId: "workspace-1", status: "done" },
        })
    })
})

describe("VideoRendersService > factsOf", () => {
    const stored = (over: Partial<VideoRenderEntity> = {}) =>
        Object.assign(new VideoRenderEntity(), {
            id: "render-1",
            status: "done",
            progress: 100,
            stage: null,
            durationMs: 12000,
            sizeBytes: "2048",
            outputPath: "w/r/video.mp4",
            posterPath: "w/r/poster.jpg",
            meta: { captions_path: "w/r/captions.vtt", captions_lang: "vi" },
            ...over,
        })

    it("answers what the workbench shows of each render, once each", async () => {
        const em = mockEntityManager({
            find: [
                VideoRenderEntity,
                [stored(), stored({ id: "render-2", sizeBytes: null, meta: { captions_path: 3 } })],
            ],
        })
        const { renders } = await build(em)

        await expect(renders.factsOf("workspace-1", ["render-1", "render-2", "render-1"])).resolves.toEqual([
            {
                id: "render-1",
                status: "done",
                progress: 100,
                stage: null,
                durationMs: 12000,
                sizeBytes: 2048,
                outputPath: "w/r/video.mp4",
                posterPath: "w/r/poster.jpg",
                captionsPath: "w/r/captions.vtt",
                captionsLang: "vi",
            },
            {
                id: "render-2",
                status: "done",
                progress: 100,
                stage: null,
                durationMs: 12000,
                sizeBytes: null,
                outputPath: "w/r/video.mp4",
                posterPath: "w/r/poster.jpg",
                captionsPath: null,
                captionsLang: null,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(VideoRenderEntity, {
            select: {
                id: true,
                status: true,
                progress: true,
                stage: true,
                durationMs: true,
                sizeBytes: true,
                outputPath: true,
                posterPath: true,
                meta: true,
            },
            where: { workspaceId: "workspace-1", id: In(["render-1", "render-2"]) },
            take: 500,
        })
    })

    it("asks nothing for no renders", async () => {
        const em = mockEntityManager()
        const { renders } = await build(em)

        await expect(renders.factsOf("workspace-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("VideoRendersService > settledOf", () => {
    it("answers a done or failed render with what a delegation card shows", async () => {
        const render = Object.assign(new VideoRenderEntity(), {
            id: "render-1",
            status: "failed",
            durationMs: null,
            outputPath: null,
            posterPath: null,
            error: "ffmpeg died",
            meta: { voiceover: "vi-VN-HoaiMyNeural" },
        })
        const em = mockEntityManager({
            findOne: [
                [VideoRenderEntity, render],
                [VideoRenderEntity, null],
            ],
        })
        const { renders } = await build(em)

        await expect(renders.settledOf("workspace-1", "render-1")).resolves.toEqual({
            id: "render-1",
            status: "failed",
            durationMs: null,
            outputPath: null,
            posterPath: null,
            captionsPath: null,
            captionsLang: null,
            voiceover: "vi-VN-HoaiMyNeural",
            error: "ffmpeg died",
        })
        await expect(renders.settledOf("workspace-1", "open")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(VideoRenderEntity, {
            select: {
                id: true,
                status: true,
                durationMs: true,
                outputPath: true,
                posterPath: true,
                error: true,
                meta: true,
            },
            where: { id: "render-1", workspaceId: "workspace-1", status: In(["done", "failed"]) },
        })
    })
})
