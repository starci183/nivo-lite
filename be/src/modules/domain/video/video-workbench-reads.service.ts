import { Injectable } from "@nestjs/common"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { RenderFacts } from "@modules/domain/video-renders"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkbenchFigures } from "./video-workbench.contracts"
import type { StoredBrand, StoredProject, StoredRender, StoredSource } from "./video-stored.contracts"

/** The module whose knowledge, credits and installation the workbench reads. */
const VIDEO_MODULE = "video"

/** How many characters of a source the picker previews. */
const SOURCE_EXCERPT_CHARS = 220

/** How many shareable sources one picker reads. */
const VIDEO_SOURCES_LIMIT = 40

/** How many days of video credits the workbench shows. */
const CREDITS_DAYS = 30

/** A render as the workbench list nests it. */
const storedRenderOf = (render: RenderFacts): StoredRender => ({
    id: render.id,
    status: render.status,
    progress: render.progress,
    stage: render.stage,
    duration_ms: render.durationMs,
    size_bytes: render.sizeBytes,
    output_path: render.outputPath,
    poster_path: render.posterPath,
    captions_path: render.captionsPath,
    captions_lang: render.captionsLang,
})

@Injectable()
/** The reads of the video workbench, each asked of the capability that owns the rows: projects, renders, the brand kit, workspace names, public sources and credits. */
export class VideoWorkbenchReadsService {
    constructor(
        private readonly projects: VideoProjectsService,
        private readonly renders: VideoRendersService,
        private readonly brandKits: VideoBrandKitsService,
        private readonly workspaces: WorkspacesService,
        private readonly knowledge: KnowledgeSourcesReadService,
        private readonly usage: AiUsageEventsService,
    ) {}

    /** The projects of a workspace, newest first, each with its current render; one project when `projectId` names it. */
    async projectsOf(
        workspaceId: string,
        projectId: string | null,
        includeArchived: boolean,
    ): Promise<Array<StoredProject>> {
        const rows = await this.projects.listForWorkbench(workspaceId, projectId, includeArchived)
        const renderIds = rows.flatMap((row) => (row.render_id === null ? [] : [row.render_id]))
        const facts = await this.renders.factsOf(workspaceId, renderIds)
        const renderOf = new Map(facts.map((render) => [render.id, storedRenderOf(render)]))
        return rows.map((row) => ({
            ...row,
            render: row.render_id === null ? null : (renderOf.get(row.render_id) ?? null),
        }))
    }

    /** The workspace name and its brand kit, when it has one; undefined when the workspace has no name. */
    async brandOf(workspaceId: string): Promise<StoredBrand | undefined> {
        const [workspaceName, kit] = await Promise.all([
            this.workspaces.nameOf(workspaceId),
            this.brandKits.kitOf(workspaceId),
        ])
        if (workspaceName === "") return undefined
        return {
            workspace_name: workspaceName,
            shop_name: kit?.shopName ?? null,
            primary_color: kit?.primaryColor ?? null,
            secondary_color: kit?.secondaryColor ?? null,
            logo_path: kit?.logoPath ?? null,
            music_track: kit?.musicTrack ?? null,
            voice: kit?.voice ?? null,
        }
    }

    /** The public, readable sources the video picker offers, with a short excerpt. */
    sourcesOf(workspaceId: string): Promise<Array<StoredSource>> {
        return this.knowledge.publicExcerpts(workspaceId, VIDEO_MODULE, SOURCE_EXCERPT_CHARS, VIDEO_SOURCES_LIMIT)
    }

    /** The project counts by state and the video credits of the last 30 days; undefined when the counts cannot be read. */
    async figuresOf(workspaceId: string): Promise<WorkbenchFigures | undefined> {
        const [credits30, counts] = await Promise.all([
            this.usage.creditsUsedBy(workspaceId, VIDEO_MODULE, CREDITS_DAYS),
            this.projects.countsOf(workspaceId),
        ])
        return counts === undefined ? undefined : { ...counts, credits30 }
    }
}
