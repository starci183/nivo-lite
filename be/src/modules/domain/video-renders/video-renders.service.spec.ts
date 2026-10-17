import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoRendersErrorCode } from "./errors/video-renders.error"
import {
    CLAIM_RENDER,
    COMPLETE_RENDER,
    COUNT_OPEN_RENDERS,
    FAIL_RENDER,
    FIND_COMPLETED_RENDER_MEDIA,
    INSERT_RENDER,
    LIST_COMPLETED_RENDER_MEDIA,
    SELECT_RENDER_STATUS,
    UPDATE_RENDER_PROGRESS,
} from "./persistence/video-renders.sql"
import { VideoRendersService } from "./video-renders.service"
import type { RenderDone } from "./video-renders.contracts"

const NEW_RENDER = { workspaceId: "workspace-1", spec: '{"version":1}', createdBy: "person-1" }

const DONE: RenderDone = {
    outputPath: "w/r/video.mp4",
    posterPath: "w/r/poster.jpg",
    durationMs: 12000,
    sizeBytes: 345,
    meta: { fps: 30 },
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [VideoRendersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(VideoRendersService)
}

describe("VideoRendersService", () => {
    describe("open", () => {
        it("writes a queued render for a workspace that has room and answers its id", async () => {
            const manager = mockEntityManager({
                query: [
                    [COUNT_OPEN_RENDERS, [{ open: 2 }]],
                    [INSERT_RENDER, [{ id: "render-1" }]],
                ],
            })
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, NEW_RENDER)).resolves.toBe("render-1")

            expect(manager.query).toHaveBeenCalledWith(COUNT_OPEN_RENDERS, ["workspace-1"])
            expect(manager.query).toHaveBeenCalledWith(INSERT_RENDER, ["workspace-1", '{"version":1}', "person-1"])
        })

        it("refuses a workspace that already has the most open renders", async () => {
            const manager = mockEntityManager({ query: [COUNT_OPEN_RENDERS, [{ open: 3 }]] })
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, NEW_RENDER)).rejects.toMatchObject({
                code: VideoRendersErrorCode.TooMany,
                params: { workspaceId: "workspace-1" },
            })
            expect(manager.query).not.toHaveBeenCalledWith(INSERT_RENDER, expect.anything())
        })

        it("counts a workspace with no answer as having none open", async () => {
            const manager = mockEntityManager({
                query: [
                    [COUNT_OPEN_RENDERS, []],
                    [INSERT_RENDER, [{ id: "render-1" }]],
                ],
            })
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, NEW_RENDER)).resolves.toBe("render-1")
        })

        it("refuses when the insert answers no row", async () => {
            const manager = mockEntityManager({
                query: [
                    [COUNT_OPEN_RENDERS, [{ open: 0 }]],
                    [INSERT_RENDER, []],
                ],
            })
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, NEW_RENDER)).rejects.toMatchObject({
                code: VideoRendersErrorCode.NotWritten,
            })
        })
    })
})

describe("VideoRendersService", () => {
    describe("claim", () => {
        it("answers the render a delivery takes", async () => {
            const em = mockEntityManager({
                query: [
                    CLAIM_RENDER,
                    [{ id: "render-1", workspace_id: "workspace-1", spec: { version: 1 }, attempts: 2 }],
                ],
            })
            const renders = await build(em)

            await expect(renders.claim("render-1")).resolves.toEqual({
                renderId: "render-1",
                workspaceId: "workspace-1",
                spec: { version: 1 },
                attempts: 2,
            })
            expect(em.query).toHaveBeenCalledWith(CLAIM_RENDER, ["render-1"])
        })

        it("answers nothing for a render that is already settled", async () => {
            const renders = await build(mockEntityManager({ query: [CLAIM_RENDER, []] }))

            await expect(renders.claim("render-1")).resolves.toBeNull()
        })
    })

    describe("reportProgress", () => {
        it.each([
            [41.6, 42],
            [150, 99],
            [-5, 0],
        ])("records %s percent as %s", async (percent, stored) => {
            const em = mockEntityManager({ query: [UPDATE_RENDER_PROGRESS, []] })
            const renders = await build(em)

            await renders.reportProgress("render-1", percent, "scenes")

            expect(em.query).toHaveBeenCalledWith(UPDATE_RENDER_PROGRESS, ["render-1", stored, "scenes"])
        })
    })

    describe("complete and fail", () => {
        it("settles a render as done in the caller's transaction", async () => {
            const manager = mockEntityManager({ query: [COMPLETE_RENDER, []] })
            const renders = await build(mockEntityManager())

            await renders.complete(manager, "render-1", DONE)

            expect(manager.query).toHaveBeenCalledWith(COMPLETE_RENDER, [
                "render-1",
                "w/r/video.mp4",
                "w/r/poster.jpg",
                12000,
                345,
                '{"fps":30}',
            ])
        })

        it("settles a render as failed in the caller's transaction", async () => {
            const manager = mockEntityManager({ query: [FAIL_RENDER, []] })
            const renders = await build(mockEntityManager())

            await renders.fail(manager, "render-1", "boom")

            expect(manager.query).toHaveBeenCalledWith(FAIL_RENDER, ["render-1", "boom"])
        })
    })
})

describe("VideoRendersService", () => {
    describe("getStatus", () => {
        it.each([
            ["queued", "queued", null, null, null, null, null],
            ["rendering", "running", "encode", "encode", "2048", 2048, null],
            ["done", "succeeded", "legacy-provider-stage", null, 4096, 4096, null],
            ["failed", "failed", "upload", "upload", null, null, "VIDEO_RENDER_FAILED"],
        ])(
            "maps %s to the public render lifecycle",
            async (status, expected, stage, expectedStage, size, expectedSize, errorCode) => {
                const em = mockEntityManager({
                    query: [
                        SELECT_RENDER_STATUS,
                        [
                            {
                                id: "render-1",
                                status,
                                progress: 76,
                                stage,
                                output_path: "workspace-1/render-1/video.mp4",
                                poster_path: "workspace-1/render-1/poster.jpg",
                                duration_ms: 12000,
                                size_bytes: size,
                            },
                        ],
                    ],
                })
                const renders = await build(em)

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
                expect(em.query).toHaveBeenCalledWith(SELECT_RENDER_STATUS, ["workspace-1", "render-1"])
            },
        )

        it("refuses an unavailable workspace render", async () => {
            const renders = await build(mockEntityManager({ query: [SELECT_RENDER_STATUS, []] }))

            await expect(renders.getStatus("workspace-1", "missing")).rejects.toMatchObject({
                code: VideoRendersErrorCode.NotFound,
                params: { renderId: "missing" },
            })
        })
    })
})

describe("VideoRendersService", () => {
    describe("completed media", () => {
        const rows = [
            {
                id: "render-1",
                title: "Offer",
                output_path: "workspace-1/render-1/video.mp4",
                duration_ms: 12000,
                created_at: new Date("2026-10-13T09:00:00.000Z"),
            },
            {
                id: "render-2",
                title: "Bakery",
                output_path: "workspace-1/render-2/video.mp4",
                duration_ms: null,
                created_at: "2026-10-14T09:00:00.000Z",
            },
        ]

        const media = [
            {
                id: "render-1",
                title: "Offer",
                outputPath: "workspace-1/render-1/video.mp4",
                durationMs: 12000,
                createdAt: "2026-10-13T09:00:00.000Z",
            },
            {
                id: "render-2",
                title: "Bakery",
                outputPath: "workspace-1/render-2/video.mp4",
                durationMs: null,
                createdAt: "2026-10-14T09:00:00.000Z",
            },
        ]

        it("lists ten completed media by default and normalizes stored timestamps", async () => {
            const em = mockEntityManager({ query: [LIST_COMPLETED_RENDER_MEDIA, rows] })
            const renders = await build(em)

            await expect(renders.listCompletedMedia("workspace-1")).resolves.toEqual(media)
            expect(em.query).toHaveBeenCalledWith(LIST_COMPLETED_RENDER_MEDIA, ["workspace-1", 10])
        })

        it.each([
            [-2, 1],
            [12.9, 12],
            [101, 100],
        ])("bounds a requested limit of %s to %s", async (limit, expected) => {
            const em = mockEntityManager({ query: [LIST_COMPLETED_RENDER_MEDIA, []] })
            const renders = await build(em)

            await expect(renders.listCompletedMedia("workspace-1", limit)).resolves.toEqual([])
            expect(em.query).toHaveBeenCalledWith(LIST_COMPLETED_RENDER_MEDIA, ["workspace-1", expected])
        })

        it("does not query when no completed media were selected", async () => {
            const em = mockEntityManager()
            const renders = await build(em)

            await expect(renders.findCompletedMedia("workspace-1", [])).resolves.toEqual([])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("deduplicates and caps selected ids before mapping the completed media", async () => {
            const em = mockEntityManager({ query: [FIND_COMPLETED_RENDER_MEDIA, rows] })
            const renders = await build(em)
            const ids = Array.from({ length: 81 }, (_entry, index) => `render-${index + 1}`)

            await expect(renders.findCompletedMedia("workspace-1", ["render-1", ...ids])).resolves.toEqual(media)
            expect(em.query).toHaveBeenCalledWith(FIND_COMPLETED_RENDER_MEDIA, ["workspace-1", ids.slice(0, 80)])
        })
    })
})
