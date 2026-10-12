import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { RecordingQueueOutbox } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoProjectVersionsService } from "@modules/domain/video-project-versions"
import { VideoRendersService } from "@modules/domain/video-renders"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { VIDEO_RENDER_QUEUE, VideoRenderQueue } from "@modules/queues/video-render"
import { VideoErrorCode } from "./errors/video.error"
import { VideoService } from "./video.service"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"

type Found = NonNullable<Awaited<ReturnType<VideoProjectsService["forRender"]>>>

const projectOf = builder<Found>({
    id: "project-1",
    workspaceId: WORKSPACE,
    aspect: "9:16",
    status: "draft",
    script: [{ caption: "Welcome", voiceover: "Hello", media: null }],
    version: 3,
    renderStatus: null,
    workspaceName: "Bakery",
    brand: {
        shopName: "Bakery Shop",
        primary: "#16a34a",
        secondary: "#0f172a",
        logoPath: null,
        musicTrack: null,
        voice: null,
    },
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const members = mock<WorkspaceMembersService>()
    const projects = mock<VideoProjectsService>()
    const versions = mock<VideoProjectVersionsService>()
    const renders = mock<VideoRendersService>()
    const catalog = mock<MessageCatalog>()
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    renders.open.mockResolvedValue("render-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoService,
            VideoRenderQueue,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoProjectsService, useValue: projects },
            { provide: VideoProjectVersionsService, useValue: versions },
            { provide: VideoRendersService, useValue: renders },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { video: moduleRef.get(VideoService), tx, members, projects, versions, renders, outbox }
}

describe("VideoService", () => {
    describe("requestRender", () => {
        it("writes the render, its version, the project's new status and the job in one transaction", async () => {
            const { video, tx, projects, versions, renders, outbox } = await build()
            projects.forRender.mockResolvedValue(projectOf())

            await expect(video.requestRender("person-1", "project-1")).resolves.toEqual({
                renderId: "render-1",
                projectId: "project-1",
            })

            const spec = renders.open.mock.calls[0]?.[1].spec ?? ""
            expect(spec).toContain('"aspect":"9:16"')
            expect(spec).toContain('"name":"Bakery Shop"')
            expect(renders.open).toHaveBeenCalledWith(expect.anything(), {
                workspaceId: WORKSPACE,
                spec,
                createdBy: "person-1",
            })
            expect(versions.record).toHaveBeenCalledWith(expect.anything(), {
                projectId: "project-1",
                workspaceId: WORKSPACE,
                version: 3,
                script: JSON.stringify([{ caption: "Welcome", voiceover: "Hello", media: null }]),
                spec,
                renderId: "render-1",
                createdBy: "person-1",
            })
            expect(projects.startRender).toHaveBeenCalledWith(expect.anything(), {
                projectId: "project-1",
                renderId: "render-1",
                spec,
            })
            expect(outbox.jobsOf(VIDEO_RENDER_QUEUE)).toEqual([
                { queue: VIDEO_RENDER_QUEUE, payload: { renderId: "render-1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("refuses a project that does not exist", async () => {
            const { video, projects, renders, outbox } = await build()
            projects.forRender.mockResolvedValue(null)

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "project-1" },
            })

            expect(renders.open).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
        })

        it("refuses anyone who does not manage the workspace", async () => {
            const { video, projects, members, renders, outbox } = await build()
            projects.forRender.mockResolvedValue(projectOf())
            const refusal = new Error("not a manager")
            members.require.mockRejectedValue(refusal)

            await expect(video.requestRender("person-1", "project-1")).rejects.toBe(refusal)

            expect(members.require).toHaveBeenCalledWith("person-1", WORKSPACE, ["owner", "manager"])
            expect(renders.open).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
        })

        it.each([
            ["a project being scripted", projectOf({ status: "scripting" })],
            ["a render waiting", projectOf({ renderStatus: "queued" })],
            ["a render running", projectOf({ renderStatus: "rendering" })],
        ])("refuses %s", async (_label, found) => {
            const { video, projects, outbox } = await build()
            projects.forRender.mockResolvedValue(found)

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectBusy,
            })
            expect(outbox.jobs).toEqual([])
        })

        it("renders again a project whose last render ended", async () => {
            const { video, projects } = await build()
            projects.forRender.mockResolvedValue(projectOf({ status: "rendering", renderStatus: "failed" }))

            await expect(video.requestRender("person-1", "project-1")).resolves.toMatchObject({ renderId: "render-1" })
        })

        it("names the video after the workspace until the owner saves a shop name, and fills in the brand defaults", async () => {
            const { video, projects, renders } = await build()
            const blank = {
                shopName: null,
                primary: null,
                secondary: null,
                logoPath: null,
                musicTrack: null,
                voice: null,
            }
            projects.forRender.mockResolvedValue(projectOf({ brand: blank }))
            await video.requestRender("person-1", "project-1")
            projects.forRender.mockResolvedValue(projectOf({ brand: { ...blank, shopName: "" } }))
            await video.requestRender("person-1", "project-1")

            for (const call of renders.open.mock.calls) {
                const spec = call[1].spec
                expect(spec).toContain('"name":"Bakery"')
                expect(spec).toContain('"primary":"#16a34a"')
                expect(spec).toContain('"name":"vi-VN-HoaiMyNeural"')
                expect(spec).toContain('"music":null')
            }
        })

        it("uses the fallback shop name when the workspace has none either", async () => {
            const { video, projects, renders } = await build()
            projects.forRender.mockResolvedValue(
                projectOf({ workspaceName: "", brand: { ...projectOf().brand, shopName: null } }),
            )

            await video.requestRender("person-1", "project-1")

            expect(renders.open.mock.calls[0]?.[1].spec).toContain('"name":"video.brand.fallback:{}"')
        })

        it("refuses a script that makes no valid spec", async () => {
            const { video, projects, renders, outbox } = await build()
            projects.forRender.mockResolvedValue(projectOf({ script: [] }))

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.SpecInvalid,
                params: { reason: "scenes: at least one scene is required" },
            })
            expect(renders.open).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
        })

        it("writes nothing when the workspace has the most renders open", async () => {
            const { video, tx, projects, versions, renders, outbox } = await build()
            projects.forRender.mockResolvedValue(projectOf())
            const full = new Error("too many")
            renders.open.mockRejectedValue(full)

            await expect(video.requestRender("person-1", "project-1")).rejects.toBe(full)

            expect(versions.record).not.toHaveBeenCalled()
            expect(projects.startRender).not.toHaveBeenCalled()
            expect(outbox.jobs).toEqual([])
            expect(tx.rollbacks).toBe(1)
        })

        it("rolls everything back when the job cannot be enqueued", async () => {
            const { video, tx, projects, outbox } = await build()
            projects.forRender.mockResolvedValue(projectOf())
            const failure = new Error("queue missing")
            outbox.failNext("write", failure)

            await expect(video.requestRender("person-1", "project-1")).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("completeRender", () => {
        it("settles the render and makes its project ready in one transaction", async () => {
            const { video, tx, projects, renders } = await build()
            const done = {
                outputPath: "w/r/video.mp4",
                posterPath: "w/r/poster.jpg",
                durationMs: 1,
                sizeBytes: 2,
                meta: {},
            }

            await video.completeRender("render-1", done)

            expect(renders.complete).toHaveBeenCalledWith(expect.anything(), "render-1", done)
            expect(projects.markReady).toHaveBeenCalledWith(expect.anything(), "render-1")
            expect(tx.commits).toBe(1)
        })
    })

    describe("failRender", () => {
        it("settles the render and sends its project back to draft with the reason in one transaction", async () => {
            const { video, tx, projects, renders } = await build()

            await video.failRender("render-1", "x".repeat(300))

            expect(renders.fail).toHaveBeenCalledWith(expect.anything(), "render-1", "x".repeat(300))
            expect(projects.markDraft).toHaveBeenCalledWith(
                expect.anything(),
                "render-1",
                `video.render.failed:{"reason":"${"x".repeat(200)}"}`,
            )
            expect(tx.commits).toBe(1)
        })
    })
})
