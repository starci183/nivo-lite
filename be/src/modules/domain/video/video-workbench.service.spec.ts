import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoErrorCode } from "./errors/video.error"
import type { StoredBrand, StoredProject } from "./video-stored.contracts"
import type { WorkbenchRender } from "./video-workbench.contracts"
import { VideoMediaService } from "./video-media.service"
import { VideoWorkbenchService } from "./video-workbench.service"

const WS = "workspace-1"

const memberOf = builder<WorkspaceMember>({
    userId: "person-1",
    workspaceId: WS,
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const rowOf = builder<StoredProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "ready",
    inputs: { notes: " fresh bread ", media: [`${WS}/a.jpg`, "other/b.jpg"] },
    script: [{ id: "s1", role: "hook", caption: "Fresh", voiceover: "Hi", visual: "", media: null }],
    version: 2,
    script_ms: 900,
    last_error: "code:VIDEO_SCRIPT_FORMAT",
    render_id: "render-1",
    render_ids: ["render-0", "render-1"],
    approved_at: new Date("2026-10-13T10:00:00.000Z"),
    approved_by_name: "Lan",
    published_at: null,
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: new Date("2026-10-13T11:00:00.000Z"),
    render: null,
})

const RENDER: WorkbenchRender = {
    id: "render-1",
    status: "done",
    progress: 100,
    stage: null,
    durationMs: 15_000,
    sizeBytes: 2048,
    errorCode: null,
    videoUrl: "https://cdn/v",
    captionsUrl: null,
    captionsLang: null,
    downloadUrl: "https://cdn/v&download=x.mp4",
    posterUrl: null,
}

const PROJECT = {
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    targetSeconds: 30,
    status: "ready",
    inputs: { sourceIds: [], notes: "fresh bread", media: [`${WS}/a.jpg`], auto: false },
    script: [{ id: "s1", role: "hook", caption: "Fresh", voiceover: "Hi", visual: "", media: null }],
    version: 2,
    scriptMs: 900,
    lastErrorCode: "VIDEO_SCRIPT_FORMAT",
    render: RENDER,
    renderCount: 2,
    approvedAt: "2026-10-13T10:00:00.000Z",
    approvedByName: "Lan",
    publishedAt: null,
    createdAt: "2026-10-13T09:00:00.000Z",
    updatedAt: "2026-10-13T11:00:00.000Z",
}

/** The statement `callDbFunction` sends for the credit value. */
const CREDIT_USD_VALUE = "SELECT * FROM public.credit_usd_value()"

/** A manager whose query builders answer in order, the way the query under test asks for them. */
const emOf = (...answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const em = mockEntityManager({ query: [CREDIT_USD_VALUE, [{ credit_usd_value: "0.01" }]] })
    const fakes = queueQueryBuilders(em, answers)
    return { em, fakes }
}

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const media = mock<VideoMediaService>()
    media.render.mockResolvedValue(RENDER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoMediaService, useValue: media },
        ],
    }).compile()
    return { workbench: moduleRef.get(VideoWorkbenchService), members, media, em }
}

describe("VideoWorkbenchService", () => {
    describe("scope", () => {
        const roles: ReadonlyArray<[WorkspaceRole, boolean]> = [
            ["owner", true],
            ["manager", true],
            ["staff", false],
        ]

        it.each(roles)("lets a %s edit: %s", async (role, canEdit) => {
            const { workbench, members } = await build()
            members.require.mockResolvedValue(memberOf({ role }))

            await expect(workbench.scope("person-1", WS)).resolves.toEqual({ workspaceId: WS, canEdit })
        })
    })

    describe("list", () => {
        it("answers the projects with their render links", async () => {
            const { em, fakes } = emOf({ getRawMany: [rowOf()] })
            const { workbench, media } = await build(em)

            await expect(workbench.list("person-1", WS)).resolves.toEqual([PROJECT])
            expect(fakes[0]?.callsOf("where")).toEqual([
                [expect.stringContaining("p.workspace_id"), { workspaceId: WS, projectId: null }],
            ])
            expect(fakes[0]?.callsOf("andWhere")).toEqual([
                [expect.stringContaining("includeArchived"), { includeArchived: false }],
            ])
            expect(media.render).toHaveBeenCalledWith(null, WS, "Spring offer")
        })

        it("includes archived projects on request", async () => {
            const { em, fakes } = emOf({ getRawMany: [] })
            const { workbench } = await build(em)

            await expect(workbench.list("person-1", WS, true)).resolves.toEqual([])
            expect(fakes[0]?.callsOf("andWhere")).toEqual([
                [expect.stringContaining("includeArchived"), { includeArchived: true }],
            ])
        })
    })

    describe("get", () => {
        it("answers one project of the workspace", async () => {
            const { em, fakes } = emOf({ getRawMany: [rowOf()] })
            const { workbench } = await build(em)

            await expect(workbench.get("person-1", WS, "project-1")).resolves.toEqual(PROJECT)
            expect(fakes[0]?.callsOf("where")).toEqual([
                [expect.stringContaining("p.workspace_id"), { workspaceId: WS, projectId: "project-1" }],
            ])
            expect(fakes[0]?.callsOf("andWhere")).toEqual([
                [expect.stringContaining("includeArchived"), { includeArchived: true }],
            ])
        })

        it("refuses a project the workspace does not have", async () => {
            const { em } = emOf({ getRawMany: [] })
            const { workbench } = await build(em)

            await expect(workbench.get("person-1", WS, "project-9")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "project-9" },
            })
        })
    })
})

describe("VideoWorkbenchService", () => {
    describe("managed", () => {
        it("answers the manager's membership with the project", async () => {
            const { em } = emOf({ getRawMany: [rowOf()] })
            const { workbench, members } = await build(em)

            await expect(workbench.managed("person-1", WS, "project-1")).resolves.toEqual({
                member: memberOf(),
                project: PROJECT,
            })
            expect(members.require).toHaveBeenCalledWith("person-1", WS, ["owner", "manager"])
        })
    })
})

describe("VideoWorkbenchService", () => {
    describe("brand", () => {
        const brandRow: StoredBrand = {
            workspace_name: " Bakery ",
            shop_name: null,
            primary_color: null,
            secondary_color: null,
            logo_path: null,
            music_track: null,
            voice: null,
        }

        it("falls back to the workspace name and the default colors and voice", async () => {
            const { em } = emOf({ getRawOne: brandRow })
            const { workbench } = await build(em)

            await expect(workbench.brand("person-1", WS)).resolves.toEqual({
                shopName: "Bakery",
                primary: "#16a34a",
                secondary: "#0f172a",
                logoPath: null,
                musicTrack: null,
                voice: "vi-VN-HoaiMyNeural",
            })
        })

        it("answers the saved kit", async () => {
            const saved: StoredBrand = {
                workspace_name: "Bakery",
                shop_name: " Bakery Shop ",
                primary_color: "#111111",
                secondary_color: "#222222",
                logo_path: `${WS}/logo.png`,
                music_track: "calm-glow",
                voice: "vi-VN-NamMinhNeural",
            }
            const { em } = emOf({ getRawOne: saved })
            const { workbench } = await build(em)

            await expect(workbench.brand("person-1", WS)).resolves.toEqual({
                shopName: "Bakery Shop",
                primary: "#111111",
                secondary: "#222222",
                logoPath: `${WS}/logo.png`,
                musicTrack: "calm-glow",
                voice: "vi-VN-NamMinhNeural",
            })
        })

        it("refuses a workspace that does not exist", async () => {
            const { em } = emOf({ getRawOne: undefined })
            const { workbench } = await build(em)

            await expect(workbench.brand("person-1", WS)).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: WS },
            })
        })
    })
})

describe("VideoWorkbenchService", () => {
    describe("sources", () => {
        it("answers the public sources of the workspace", async () => {
            const sources = [{ id: "source-1", title: "Menu", topic: null, excerpt: "Bread" }]
            const { em, fakes } = emOf({ getRawMany: sources })
            const { workbench } = await build(em)

            await expect(workbench.sources("person-1", WS)).resolves.toEqual(sources)
            expect(fakes[0]?.callsOf("where")).toEqual([
                [expect.stringContaining("s.workspace_id"), { workspaceId: WS }],
            ])
        })
    })

    describe("figures", () => {
        it("answers the month's figures", async () => {
            const figures = { rendering: 1, scripting: 0, readyToPublish: 2, approved: 1, published30: 3, credits30: 9 }
            const { em } = emOf({ getRawOne: { credits30: 9 } }, { getRawOne: { ...figures, credits30: undefined } })
            const { workbench } = await build(em)

            await expect(workbench.figures("person-1", WS)).resolves.toEqual(figures)
        })

        it("fails when the figures row is missing", async () => {
            const { em } = emOf({ getRawOne: undefined }, { getRawOne: undefined })
            const { workbench } = await build(em)

            await expect(workbench.figures("person-1", WS)).rejects.toMatchObject({ code: VideoErrorCode.InputInvalid })
        })
    })
})
