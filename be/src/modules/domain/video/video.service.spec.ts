import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoProjectVersionsService } from "@modules/domain/video-project-versions"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoRenderQueue } from "@modules/queues/video-render"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { ProjectForRender } from "./video.contracts"
import { VideoService } from "./video.service"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"

type Found = ProjectForRender

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
    const queue = mock<VideoRenderQueue>()
    const brandKits = mock<VideoBrandKitsService>()
    const workspaces = mock<WorkspacesService>()
    /** Makes the owners answer as the given project says: the locked row, the workspace name, the kit and the render status. */
    const stage = (found: Found | null): void => {
        if (found === null) {
            projects.lockForRender.mockResolvedValue(null)
            return
        }
        const { brand } = found
        const hasKit = Object.values(brand).some((value) => value !== null)
        projects.lockForRender.mockResolvedValue({
            id: found.id,
            workspaceId: found.workspaceId,
            aspect: found.aspect,
            status: found.status,
            script: found.script,
            version: found.version,
            renderId: found.renderStatus === null ? null : "render-0",
        })
        workspaces.nameOf.mockResolvedValue(found.workspaceName)
        brandKits.kitOf.mockResolvedValue(
            hasKit
                ? {
                      shopName: brand.shopName ?? "",
                      primaryColor: brand.primary ?? "",
                      secondaryColor: brand.secondary ?? "",
                      logoPath: brand.logoPath,
                      musicTrack: brand.musicTrack,
                      voice: brand.voice ?? "",
                  }
                : null,
        )
        renders.stateOf.mockResolvedValue(found.renderStatus)
    }
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    renders.open.mockResolvedValue("render-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoProjectsService, useValue: projects },
            { provide: VideoProjectVersionsService, useValue: versions },
            { provide: VideoRendersService, useValue: renders },
            { provide: VideoBrandKitsService, useValue: brandKits },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: VideoRenderQueue, useValue: queue },
        ],
    }).compile()
    return {
        video: moduleRef.get(VideoService),
        tx,
        members,
        projects,
        versions,
        renders,
        queue,
        brandKits,
        workspaces,
        stage,
    }
}

describe("VideoService", () => {
    describe("requestRender", () => {
        it("writes the render, its version, the project's new status and the job in one transaction", async () => {
            const { video, tx, projects, versions, renders, queue, stage } = await build()
            stage(projectOf())

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
            const manager = renders.open.mock.calls[0]?.[0]
            expect(queue.enqueueRenderVideo).toHaveBeenCalledWith(
                { renderId: "render-1", workspaceId: WORKSPACE },
                manager,
            )
            expect(tx.commits).toBe(1)
        })

        it("refuses a project that does not exist", async () => {
            const { video, renders, queue, stage } = await build()
            stage(null)

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "project-1" },
            })

            expect(renders.open).not.toHaveBeenCalled()
            expect(queue.enqueueRenderVideo).not.toHaveBeenCalled()
        })
    })
})

describe("VideoService", () => {
    describe("requestRender", () => {
        it("refuses anyone who does not manage the workspace", async () => {
            const { video, members, renders, queue, stage } = await build()
            stage(projectOf())
            const refusal = new VideoError({ code: VideoErrorCode.NotApproved })
            members.require.mockRejectedValue(refusal)

            await expect(video.requestRender("person-1", "project-1")).rejects.toBe(refusal)

            expect(members.require).toHaveBeenCalledWith("person-1", WORKSPACE, ["owner", "manager"])
            expect(renders.open).not.toHaveBeenCalled()
            expect(queue.enqueueRenderVideo).not.toHaveBeenCalled()
        })

        it.each([
            ["a project being scripted", projectOf({ status: "scripting" })],
            ["a render waiting", projectOf({ renderStatus: "queued" })],
            ["a render running", projectOf({ renderStatus: "rendering" })],
        ])("refuses %s", async (_label, found) => {
            const { video, queue, stage } = await build()
            stage(found)

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectBusy,
            })
            expect(queue.enqueueRenderVideo).not.toHaveBeenCalled()
        })

        it("renders again a project whose last render ended", async () => {
            const { video, stage } = await build()
            stage(projectOf({ status: "rendering", renderStatus: "failed" }))

            await expect(video.requestRender("person-1", "project-1")).resolves.toMatchObject({ renderId: "render-1" })
        })
    })
})

describe("VideoService", () => {
    describe("requestRender", () => {
        it("names the video after the workspace until the owner saves a shop name, and fills in the brand defaults", async () => {
            const { video, renders, stage } = await build()
            const blank = {
                shopName: null,
                primary: null,
                secondary: null,
                logoPath: null,
                musicTrack: null,
                voice: null,
            }
            stage(projectOf({ brand: blank }))
            await video.requestRender("person-1", "project-1")
            stage(projectOf({ brand: { ...blank, shopName: "" } }))
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
            const { video, renders, stage } = await build()
            stage(projectOf({ workspaceName: "", brand: { ...projectOf().brand, shopName: null } }))

            await video.requestRender("person-1", "project-1")

            expect(renders.open.mock.calls[0]?.[1].spec).toContain('"name":"video.brand.fallback:{}"')
        })

        it("refuses a script that makes no valid spec", async () => {
            const { video, renders, queue, stage } = await build()
            stage(projectOf({ script: [] }))

            await expect(video.requestRender("person-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.SpecInvalid,
                params: { reason: "scenes: at least one scene is required" },
            })
            expect(renders.open).not.toHaveBeenCalled()
            expect(queue.enqueueRenderVideo).not.toHaveBeenCalled()
        })
    })
})

describe("VideoService", () => {
    describe("requestRender", () => {
        it("writes nothing when the workspace has the most renders open", async () => {
            const { video, tx, projects, versions, renders, queue, stage } = await build()
            stage(projectOf())
            const full = new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId: "project-1" } })
            renders.open.mockRejectedValue(full)

            await expect(video.requestRender("person-1", "project-1")).rejects.toBe(full)

            expect(versions.record).not.toHaveBeenCalled()
            expect(projects.startRender).not.toHaveBeenCalled()
            expect(queue.enqueueRenderVideo).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })

        it("rolls everything back when the job cannot be enqueued", async () => {
            const { video, tx, queue, stage } = await build()
            stage(projectOf())
            const failure = new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: "queue" } })
            queue.enqueueRenderVideo.mockRejectedValue(failure)

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
})

describe("VideoService", () => {
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

describe("VideoService", () => {
    describe("requestDelegatedRender", () => {
        it("queues a framed render with no creator for a project of the delegating workspace", async () => {
            const { video, members, versions, renders, queue, stage } = await build()
            stage(projectOf())

            await expect(video.requestDelegatedRender(WORKSPACE, "project-1")).resolves.toEqual({
                renderId: "render-1",
                projectId: "project-1",
            })

            const spec = renders.open.mock.calls[0]?.[1].spec ?? ""
            expect(spec).toContain('"frame":true')
            expect(renders.open).toHaveBeenCalledWith(expect.anything(), {
                workspaceId: WORKSPACE,
                spec,
                createdBy: null,
            })
            expect(versions.record).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ createdBy: null }),
            )
            expect(queue.enqueueRenderVideo).toHaveBeenCalled()
            expect(members.require).not.toHaveBeenCalled()
        })

        it.each([null, projectOf({ workspaceId: "other-workspace" })])(
            "refuses a project that is missing or belongs to another workspace",
            async (found) => {
                const { video, renders, stage } = await build()
                stage(found)

                await expect(video.requestDelegatedRender(WORKSPACE, "project-1")).rejects.toMatchObject({
                    code: VideoErrorCode.ProjectNotFound,
                })
                expect(renders.open).not.toHaveBeenCalled()
            },
        )
    })
})
