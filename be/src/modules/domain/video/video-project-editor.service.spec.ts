import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoErrorCode } from "./errors/video.error"
import type { BrandKit } from "./video-script.policy"
import { VideoProjectEditorService } from "./video-project-editor.service"
import type { WorkbenchProject } from "./video-workbench.contracts"
import { VideoWorkbenchService } from "./video-workbench.service"

const WS = "workspace-1"
const SOURCE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"

const MEMBER: WorkspaceMember = {
    userId: "person-1",
    workspaceId: WS,
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const projectOf = builder<WorkbenchProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    targetSeconds: 30,
    status: "draft",
    inputs: { sourceIds: [], notes: "", media: [], auto: false },
    script: [],
    version: 1,
    scriptMs: null,
    lastErrorCode: null,
    render: null,
    renderCount: 0,
    approvedAt: null,
    approvedByName: null,
    publishedAt: null,
    createdAt: "2026-10-13T09:00:00.000Z",
    updatedAt: "2026-10-13T09:00:00.000Z",
})

const KIT: BrandKit = {
    shopName: "Bakery",
    primary: "#16a34a",
    secondary: "#0f172a",
    logoPath: null,
    musicTrack: null,
    voice: "vi-VN-HoaiMyNeural",
}

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const workbench = mock<VideoWorkbenchService>()
    workbench.get.mockImplementation((_principal, _workspace, projectId) =>
        Promise.resolve(projectOf({ id: projectId })),
    )
    workbench.brand.mockResolvedValue(KIT)
    const writer = mock<VideoProjectWorkbenchWriterService>()
    const events = mock<EventsService>()
    const brands = mock<VideoBrandKitsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoProjectEditorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: VideoProjectWorkbenchWriterService, useValue: writer },
            { provide: EventsService, useValue: events },
            { provide: VideoBrandKitsService, useValue: brands },
        ],
    }).compile()
    return { editor: moduleRef.get(VideoProjectEditorService), tx, members, workbench, writer, events, brands }
}

describe("VideoProjectEditorService", () => {
    describe("create", () => {
        it("saves the draft with workspace-checked inputs and its event in one transaction", async () => {
            const { editor, tx, members, writer, events } = await build()
            writer.create.mockResolvedValue("project-2")

            await expect(
                editor.create("person-1", WS, {
                    goal: "offer",
                    aspect: "9:16",
                    targetSeconds: 30,
                    inputs: {
                        sourceIds: [SOURCE, "bad"],
                        notes: "x",
                        media: [`${WS}/a.jpg`, "other/b.jpg"],
                        auto: false,
                    },
                }),
            ).resolves.toEqual(projectOf({ id: "project-2" }))

            expect(members.require).toHaveBeenCalledWith("person-1", WS, ["owner", "manager"])
            expect(writer.create.mock.calls[0]?.[3]).toEqual({
                goal: "offer",
                aspect: "9:16",
                targetSeconds: 30,
                inputs: { sourceIds: [SOURCE], notes: "x", media: [`${WS}/a.jpg`], auto: false },
            })
            expect(events.record.mock.calls[0]?.[0]).toEqual({
                workspaceId: WS,
                kind: "video.project_created",
                actor: "Lan",
                summary: "offer",
            })
            expect(tx.commits).toBe(1)
        })

        it("rolls back and refuses a draft the writer did not save", async () => {
            const { editor, tx, writer, events } = await build()
            writer.create.mockResolvedValue(null)

            await expect(
                editor.create("person-1", WS, { title: "T", goal: "offer", aspect: "9:16", targetSeconds: 30 }),
            ).rejects.toMatchObject({ code: VideoErrorCode.InputInvalid })
            expect(events.record).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("update", () => {
        it("cleans the changed inputs and scenes before saving", async () => {
            const { editor, writer } = await build()
            writer.update.mockResolvedValue(true)

            await expect(
                editor.update("person-1", WS, "project-1", {
                    title: "New",
                    script: [
                        { id: "s1", role: "boss", caption: " Hello ", voiceover: "", visual: "", media: "x/y.jpg" },
                    ],
                }),
            ).resolves.toEqual(projectOf())

            expect(writer.update).toHaveBeenCalledWith(WS, "project-1", {
                title: "New",
                script: [{ id: "s1", role: "body", caption: "Hello", voiceover: "", visual: "", media: null }],
            })
        })

        it("refuses a busy project", async () => {
            const { editor, writer } = await build()
            writer.update.mockResolvedValue(false)

            await expect(editor.update("person-1", WS, "project-1", { goal: "hiring" })).rejects.toMatchObject({
                code: VideoErrorCode.ProjectBusy,
                params: { projectId: "project-1" },
            })
        })
    })

    describe("duplicate", () => {
        it("answers the copy and records the event in one transaction", async () => {
            const { editor, tx, writer, events } = await build()
            writer.duplicate.mockResolvedValue("project-3")

            await expect(editor.duplicate("person-1", WS, "project-1")).resolves.toEqual(projectOf({ id: "project-3" }))
            expect(events.record.mock.calls[0]?.[0]).toEqual({
                workspaceId: WS,
                kind: "video.project_duplicated",
                actor: "Lan",
                summary: "project-1",
            })
            expect(tx.commits).toBe(1)
        })

        it("refuses a project that is not there", async () => {
            const { editor, tx, writer } = await build()
            writer.duplicate.mockResolvedValue(null)

            await expect(editor.duplicate("person-1", WS, "project-9")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "project-9" },
            })
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("archive", () => {
        it("answers the archived project", async () => {
            const { editor, writer } = await build()
            writer.archive.mockResolvedValue(true)

            await expect(editor.archive("person-1", WS, "project-1", true)).resolves.toEqual(projectOf())
            expect(writer.archive).toHaveBeenCalledWith(WS, "project-1", true)
        })

        it("refuses a busy project", async () => {
            const { editor, writer } = await build()
            writer.archive.mockResolvedValue(false)

            await expect(editor.archive("person-1", WS, "project-1", false)).rejects.toMatchObject({
                code: VideoErrorCode.ProjectBusy,
            })
        })
    })

    describe("publish", () => {
        it("records the owner's own publication in one transaction", async () => {
            const { editor, tx, writer, events } = await build()
            writer.publish.mockResolvedValue(true)

            await expect(editor.publish("person-1", WS, "project-1")).resolves.toEqual(projectOf())
            expect(events.record.mock.calls[0]?.[0]).toEqual({
                workspaceId: WS,
                kind: "video.published_by_owner",
                actor: "Lan",
                summary: "project-1",
            })
            expect(tx.commits).toBe(1)
        })

        it("refuses a project that was not approved", async () => {
            const { editor, tx, writer, events } = await build()
            writer.publish.mockResolvedValue(false)

            await expect(editor.publish("person-1", WS, "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(events.record).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("saveBrand", () => {
        it("normalises the kit before saving and answers the saved kit", async () => {
            const { editor, brands } = await build()

            await expect(
                editor.saveBrand("person-1", WS, {
                    shopName: "  Bakery ",
                    primary: "#ABC",
                    secondary: "blue",
                    logoPath: `${WS}/logo.png`,
                    musicTrack: "calm-glow",
                    voice: "vi-VN-NamMinhNeural",
                }),
            ).resolves.toEqual(KIT)

            expect(brands.save).toHaveBeenCalledWith(WS, "person-1", {
                shopName: "Bakery",
                primary: "#aabbcc",
                secondary: null,
                logoPath: `${WS}/logo.png`,
                musicTrack: "calm-glow",
                voice: "vi-VN-NamMinhNeural",
            })
        })

        it("drops an unknown track and voice", async () => {
            const { editor, brands } = await build()

            await editor.saveBrand("person-1", WS, { ...KIT, musicTrack: "polka", voice: "en-US-Jenny" })

            expect(brands.save.mock.calls[0]?.[2]).toMatchObject({ musicTrack: null, voice: "vi-VN-HoaiMyNeural" })
        })

        it("refuses a logo outside the workspace", async () => {
            const { editor, brands } = await build()

            await expect(
                editor.saveBrand("person-1", WS, { ...KIT, logoPath: "other/logo.png" }),
            ).rejects.toMatchObject({
                code: VideoErrorCode.InputInvalid,
            })
            expect(brands.save).not.toHaveBeenCalled()
        })
    })
})
