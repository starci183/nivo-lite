import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, LessThanOrEqual } from "typeorm"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoRendersErrorCode } from "./errors/video-renders.error"
import { VideoRenderEntity } from "./persistence/entities"
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

const OPEN = ["queued", "rendering"]

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [VideoRendersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(VideoRendersService)
}

/** A manager whose query builder is the given double. */
const managerWith = (
    builder: ReturnType<typeof fakeQueryBuilder>,
    stubs: Parameters<typeof mockEntityManager>[0] = {},
) => {
    const manager = mockEntityManager(stubs)
    manager.createQueryBuilder.mockReturnValue(builder.builder as never)
    return manager
}

const inserted = (id?: string) => ({
    identifiers: id === undefined ? [] : [{ id }],
    generatedMaps: [],
    raw: [],
})

describe("VideoRendersService", () => {
    describe("open", () => {
        it("writes a queued render for a workspace that has room and answers its id", async () => {
            const manager = mockEntityManager({
                count: [VideoRenderEntity, 2],
                insert: [VideoRenderEntity, inserted("render-1")],
            })
            const renders = await build(mockEntityManager())

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
            const renders = await build(mockEntityManager())

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
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, NEW_RENDER)).resolves.toBe("render-1")
        })

        it("refuses a spec that is not JSON before touching the database", async () => {
            const manager = mockEntityManager()
            const renders = await build(mockEntityManager())

            await expect(renders.open(manager, { ...NEW_RENDER, spec: "{not json" })).rejects.toMatchObject({
                code: VideoRendersErrorCode.JsonUnreadable,
            })
            expect(manager.count).not.toHaveBeenCalled()
            expect(manager.insert).not.toHaveBeenCalled()
        })

        it("refuses when the insert answers no row", async () => {
            const manager = mockEntityManager({
                count: [VideoRenderEntity, 0],
                insert: [VideoRenderEntity, inserted()],
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
            const update = fakeQueryBuilder({
                execute: {
                    raw: [{ id: "render-1", workspace_id: "workspace-1", spec: { version: 1 }, meta: { attempts: 2 } }],
                },
            })
            const em = managerWith(update)
            const renders = await build(em)

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
            expect(evaluatedValues(update.callsOf("set")[0]?.[0])).toEqual({
                status: "rendering",
                startedAt: "COALESCE(started_at, now())",
                error: null,
                meta: "jsonb_set(meta, '{attempts}', to_jsonb(COALESCE((meta ->> 'attempts')::int, 0) + 1))",
            })
        })

        it("answers nothing for a render that is already settled", async () => {
            const renders = await build(managerWith(fakeQueryBuilder({ execute: { raw: [] } })))

            await expect(renders.claim("render-1")).resolves.toBeNull()
        })
    })

    describe("reportProgress", () => {
        it.each([
            [41.6, 42],
            [150, 99],
            [-5, 0],
        ])("records %s percent as %s", async (percent, stored) => {
            const em = mockEntityManager({ update: [VideoRenderEntity, { affected: 1 }] })
            const renders = await build(em)

            await renders.reportProgress("render-1", percent, "scenes")

            expect(em.update).toHaveBeenCalledWith(
                VideoRenderEntity,
                { id: "render-1", status: In(OPEN), progress: LessThanOrEqual(stored) },
                { status: "rendering", progress: stored, stage: "scenes" },
            )
        })
    })

    describe("complete and fail", () => {
        it("settles a render as done in the caller's transaction", async () => {
            const update = fakeQueryBuilder({ execute: { raw: [] } })
            const manager = managerWith(update)
            const renders = await build(mockEntityManager())

            await renders.complete(manager, "render-1", DONE)

            expect(evaluatedValues(update.callsOf("set")[0]?.[0])).toEqual({
                status: "done",
                progress: 100,
                stage: null,
                outputPath: "w/r/video.mp4",
                posterPath: "w/r/poster.jpg",
                durationMs: 12000,
                sizeBytes: "345",
                error: null,
                meta: "meta || CAST(:report AS jsonb)",
                finishedAt: "now()",
            })
            expect(update.callsOf("where")).toEqual([
                ["id = :renderId AND status IN (:...open)", { renderId: "render-1", open: OPEN }],
            ])
            expect(update.callsOf("setParameter")).toEqual([["report", '{"fps":30}']])
        })

        it("settles a render as failed in the caller's transaction", async () => {
            const update = fakeQueryBuilder({ execute: { raw: [] } })
            const manager = managerWith(update)
            const renders = await build(mockEntityManager())

            await renders.fail(manager, "render-1", "boom")

            expect(evaluatedValues(update.callsOf("set")[0]?.[0])).toEqual({
                status: "failed",
                error: "left(:reason, 300)",
                finishedAt: "now()",
            })
            expect(update.callsOf("setParameter")).toEqual([["reason", "boom"]])
            expect(update.callsOf("where")).toEqual([
                ["id = :renderId AND status IN (:...open)", { renderId: "render-1", open: OPEN }],
            ])
        })
    })
})

describe("VideoRendersService", () => {
    describe("getStatus", () => {
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
                expect(em.findOne).toHaveBeenCalledWith(
                    VideoRenderEntity,
                    expect.objectContaining({ where: { workspaceId: "workspace-1", id: "render-1" } }),
                )
            },
        )

        it("refuses an unavailable workspace render", async () => {
            const renders = await build(mockEntityManager({ findOne: [VideoRenderEntity, null] }))

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
            const read = fakeQueryBuilder({ getRawMany: rows })
            const em = managerWith(read)
            const renders = await build(em)

            await expect(renders.listCompletedMedia("workspace-1")).resolves.toEqual(media)
            expect(em.createQueryBuilder).toHaveBeenCalledWith(VideoRenderEntity, "r")
            expect(read.callsOf("where")).toEqual([["r.workspaceId = :workspaceId", { workspaceId: "workspace-1" }]])
            expect(read.callsOf("andWhere")).toEqual([
                ["r.status = :done", { done: "done" }],
                ["r.outputPath IS NOT NULL"],
            ])
            expect(read.callsOf("limit")).toEqual([[10]])
        })

        it.each([
            [-2, 1],
            [12.9, 12],
            [101, 100],
        ])("bounds a requested limit of %s to %s", async (limit, expected) => {
            const read = fakeQueryBuilder({ getRawMany: [] })
            const renders = await build(managerWith(read))

            await expect(renders.listCompletedMedia("workspace-1", limit)).resolves.toEqual([])
            expect(read.callsOf("limit")).toEqual([[expected]])
        })

        it("does not query when no completed media were selected", async () => {
            const em = mockEntityManager()
            const renders = await build(em)

            await expect(renders.findCompletedMedia("workspace-1", [])).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("deduplicates and caps selected ids before mapping the completed media", async () => {
            const read = fakeQueryBuilder({ getRawMany: rows })
            const renders = await build(managerWith(read))
            const ids = Array.from({ length: 81 }, (_entry, index) => `render-${index + 1}`)

            await expect(renders.findCompletedMedia("workspace-1", ["render-1", ...ids])).resolves.toEqual(media)
            expect(read.callsOf("andWhere")).toContainEqual(["r.id IN (:...ids)", { ids: ids.slice(0, 80) }])
            expect(read.callsOf("limit")).toEqual([[80]])
        })
    })
})
