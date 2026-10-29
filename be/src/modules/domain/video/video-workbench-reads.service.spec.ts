import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import type { VideoBrandKit } from "@modules/domain/video-brand-kits"
import { VideoProjectsService } from "@modules/domain/video-projects"
import type { ProjectRow } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { RenderFacts } from "@modules/domain/video-renders"
import { WorkspacesService } from "@modules/domain/workspaces"
import { VideoWorkbenchReadsService } from "./video-workbench-reads.service"

const WS = "workspace-1"

const projectRowOf = builder<ProjectRow>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "ready",
    inputs: {},
    script: [],
    version: 2,
    script_ms: null,
    last_error: null,
    render_id: "render-1",
    render_ids: ["render-0", "render-1"],
    approved_at: null,
    approved_by_name: null,
    published_at: null,
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T11:00:00.000Z",
})

const factsOf = builder<RenderFacts>({
    id: "render-1",
    status: "done",
    progress: 100,
    stage: null,
    durationMs: 15_000,
    sizeBytes: 2048,
    outputPath: `${WS}/render-1/video.mp4`,
    posterPath: `${WS}/render-1/poster.jpg`,
    captionsPath: `${WS}/render-1/captions.vtt`,
    captionsLang: "vi",
})

const kitOf = builder<VideoBrandKit>({
    shopName: "Bakery Shop",
    primaryColor: "#111111",
    secondaryColor: "#222222",
    logoPath: `${WS}/logo.png`,
    musicTrack: "calm-glow",
    voice: "vi-VN-NamMinhNeural",
})

const build = async () => {
    const projects = mock<VideoProjectsService>()
    const renders = mock<VideoRendersService>()
    const brandKits = mock<VideoBrandKitsService>()
    const workspaces = mock<WorkspacesService>()
    const knowledge = mock<KnowledgeSourcesReadService>()
    const usage = mock<AiUsageEventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoWorkbenchReadsService,
            { provide: VideoProjectsService, useValue: projects },
            { provide: VideoRendersService, useValue: renders },
            { provide: VideoBrandKitsService, useValue: brandKits },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: KnowledgeSourcesReadService, useValue: knowledge },
            { provide: AiUsageEventsService, useValue: usage },
        ],
    }).compile()
    return {
        reads: moduleRef.get(VideoWorkbenchReadsService),
        projects,
        renders,
        brandKits,
        workspaces,
        knowledge,
        usage,
    }
}

describe("VideoWorkbenchReadsService > projectsOf", () => {
    it("nests the current render of each project, read once from the render owner", async () => {
        const { reads, projects, renders } = await build()
        projects.listForWorkbench.mockResolvedValue([
            projectRowOf(),
            projectRowOf({ id: "project-2", render_id: null }),
            projectRowOf({ id: "project-3", render_id: "render-gone" }),
        ])
        renders.factsOf.mockResolvedValue([factsOf()])

        await expect(reads.projectsOf(WS, null, false)).resolves.toEqual([
            {
                ...projectRowOf(),
                render: {
                    id: "render-1",
                    status: "done",
                    progress: 100,
                    stage: null,
                    duration_ms: 15_000,
                    size_bytes: 2048,
                    output_path: `${WS}/render-1/video.mp4`,
                    poster_path: `${WS}/render-1/poster.jpg`,
                    captions_path: `${WS}/render-1/captions.vtt`,
                    captions_lang: "vi",
                },
            },
            { ...projectRowOf({ id: "project-2", render_id: null }), render: null },
            { ...projectRowOf({ id: "project-3", render_id: "render-gone" }), render: null },
        ])
        expect(projects.listForWorkbench).toHaveBeenCalledWith(WS, null, false)
        expect(renders.factsOf).toHaveBeenCalledWith(WS, ["render-1", "render-gone"])
    })
})

describe("VideoWorkbenchReadsService > brandOf", () => {
    it("answers the workspace name with the saved kit", async () => {
        const { reads, workspaces, brandKits } = await build()
        workspaces.nameOf.mockResolvedValue("Bakery")
        brandKits.kitOf.mockResolvedValue(kitOf())

        await expect(reads.brandOf(WS)).resolves.toEqual({
            workspace_name: "Bakery",
            shop_name: "Bakery Shop",
            primary_color: "#111111",
            secondary_color: "#222222",
            logo_path: `${WS}/logo.png`,
            music_track: "calm-glow",
            voice: "vi-VN-NamMinhNeural",
        })
    })

    it("answers the workspace name alone when no kit was saved", async () => {
        const { reads, workspaces, brandKits } = await build()
        workspaces.nameOf.mockResolvedValue("Bakery")
        brandKits.kitOf.mockResolvedValue(null)

        await expect(reads.brandOf(WS)).resolves.toEqual({
            workspace_name: "Bakery",
            shop_name: null,
            primary_color: null,
            secondary_color: null,
            logo_path: null,
            music_track: null,
            voice: null,
        })
    })

    it("answers nothing for a workspace without a name", async () => {
        const { reads, workspaces, brandKits } = await build()
        workspaces.nameOf.mockResolvedValue("")
        brandKits.kitOf.mockResolvedValue(null)

        await expect(reads.brandOf(WS)).resolves.toBeUndefined()
    })
})

describe("VideoWorkbenchReadsService > sourcesOf", () => {
    it("lists the public video sources with a 220 character excerpt, at most forty", async () => {
        const { reads, knowledge } = await build()
        const sources = [{ id: "source-1", title: "Menu", topic: null, excerpt: "Bread" }]
        knowledge.publicExcerpts.mockResolvedValue(sources)

        await expect(reads.sourcesOf(WS)).resolves.toBe(sources)
        expect(knowledge.publicExcerpts).toHaveBeenCalledWith(WS, "video", 220, 40)
    })
})

describe("VideoWorkbenchReadsService > figuresOf", () => {
    it("joins the project counts with the video credits of the last thirty days", async () => {
        const { reads, projects, usage } = await build()
        projects.countsOf.mockResolvedValue({
            rendering: 1,
            scripting: 0,
            readyToPublish: 2,
            approved: 1,
            published30: 3,
        })
        usage.creditsUsedBy.mockResolvedValue(9)

        await expect(reads.figuresOf(WS)).resolves.toEqual({
            rendering: 1,
            scripting: 0,
            readyToPublish: 2,
            approved: 1,
            published30: 3,
            credits30: 9,
        })
        expect(usage.creditsUsedBy).toHaveBeenCalledWith(WS, "video", 30)
    })

    it("answers nothing when the counts cannot be read", async () => {
        const { reads, projects, usage } = await build()
        projects.countsOf.mockResolvedValue(undefined)
        usage.creditsUsedBy.mockResolvedValue(0)

        await expect(reads.figuresOf(WS)).resolves.toBeUndefined()
    })
})
