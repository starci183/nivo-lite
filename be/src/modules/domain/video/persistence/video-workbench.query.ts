import type { EntityManager } from "typeorm"
import { AiUsageEventEntity } from "@modules/domain/ai-usage-events"
import { VideoBrandKitEntity } from "@modules/domain/video-brand-kits"
import { VideoProjectEntity } from "@modules/domain/video-projects"
import { VideoRenderEntity } from "@modules/domain/video-renders"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { callDbFunction } from "@modules/platform/database"
import type { WorkbenchFigures } from "../video-workbench.contracts"
import type { StoredBrand, StoredProject, StoredSource } from "../video-stored.contracts"

/** How many projects one workbench list reads. */
const WORKBENCH_PROJECTS_LIMIT = 60

/** How many shareable sources one picker reads. */
const VIDEO_SOURCES_LIMIT = 40

/** The table of knowledge sources: its owner has not landed an entity yet. */
const KNOWLEDGE_SOURCES_TABLE = "public.knowledge_sources"

/** The render of a project as the workbench list nests it. */
const RENDER_OBJECT = `CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'status', r.status, 'progress', r.progress,
'stage', r.stage, 'duration_ms', r.duration_ms, 'size_bytes', r.size_bytes, 'output_path', r.output_path, 'poster_path', r.poster_path,
'captions_path', r.meta ->> 'captions_path', 'captions_lang', r.meta ->> 'captions_lang') END`

/** The projects of a workspace, newest first, each with its current render; one project when `projectId` names it. */
export const listWorkbenchProjects = (
    manager: EntityManager,
    workspaceId: string,
    projectId: string | null,
    includeArchived: boolean,
): Promise<Array<StoredProject>> =>
    manager
        .createQueryBuilder(VideoProjectEntity, "p")
        .leftJoin(VideoRenderEntity, "r", "r.id = p.render_id AND r.workspace_id = p.workspace_id")
        .select("p.*")
        .addSelect(RENDER_OBJECT, "render")
        .where("p.workspace_id = :workspaceId AND (:projectId::uuid IS NULL OR p.id = :projectId)", {
            workspaceId,
            projectId,
        })
        .andWhere("(:includeArchived::boolean OR p.status <> 'archived')", { includeArchived })
        .orderBy("p.updatedAt", "DESC")
        .limit(WORKBENCH_PROJECTS_LIMIT)
        .getRawMany<StoredProject>()

/** The workspace name and its brand kit, when it has one. */
export const readWorkbenchBrand = (manager: EntityManager, workspaceId: string): Promise<StoredBrand | undefined> =>
    manager
        .createQueryBuilder(WorkspaceEntity, "w")
        .leftJoin(VideoBrandKitEntity, "k", "k.workspace_id = w.id")
        .select("w.name", "workspace_name")
        .addSelect("k.shop_name", "shop_name")
        .addSelect("k.primary_color", "primary_color")
        .addSelect("k.secondary_color", "secondary_color")
        .addSelect("k.logo_path", "logo_path")
        .addSelect("k.music_track", "music_track")
        .addSelect("k.voice", "voice")
        .where("w.id = :workspaceId", { workspaceId })
        .limit(1)
        .getRawOne<StoredBrand>()

/** The public, readable sources the video picker offers, with a short excerpt. */
export const listVideoSources = (manager: EntityManager, workspaceId: string): Promise<Array<StoredSource>> =>
    manager
        .createQueryBuilder()
        .select("s.id", "id")
        .addSelect("s.title", "title")
        .addSelect("s.topic", "topic")
        .addSelect("left(regexp_replace(s.content, '\\s+', ' ', 'g'), 220)", "excerpt")
        .from(KNOWLEDGE_SOURCES_TABLE, "s")
        .where("s.workspace_id = :workspaceId AND s.visibility = 'public'", { workspaceId })
        .andWhere("s.status IN ('ready', 'extracting_facts') AND (s.module IS NULL OR s.module = 'video')")
        .andWhere("s.installation_id IS NULL")
        .orderBy("s.created_at", "DESC")
        .limit(VIDEO_SOURCES_LIMIT)
        .getRawMany<StoredSource>()

/** The dollar value of one credit, as the database function answers it. */
const creditUsdValue = async (manager: EntityManager): Promise<number> => {
    const [row] = await callDbFunction<{ credit_usd_value: string | number }>(manager, "public.credit_usd_value", [])
    return Number(row?.credit_usd_value ?? 0)
}

/** The project counts by state and the video credits of the last 30 days. */
export const readVideoFigures = async (
    manager: EntityManager,
    workspaceId: string,
): Promise<WorkbenchFigures | undefined> => {
    const creditUsd = await creditUsdValue(manager)
    const credits = await manager
        .createQueryBuilder(AiUsageEventEntity, "u")
        .select("COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits30")
        .where("u.workspace_id = :workspaceId AND u.module = 'video'", { workspaceId, creditUsd })
        .andWhere("u.created_at >= now() - interval '30 days'")
        .getRawOne<{ credits30: number }>()
    const counts = await manager
        .createQueryBuilder(VideoProjectEntity, "p")
        .select("count(*) FILTER (WHERE p.status = 'rendering')::int", "rendering")
        .addSelect("count(*) FILTER (WHERE p.status = 'scripting')::int", "scripting")
        .addSelect("count(*) FILTER (WHERE p.status IN ('ready', 'approved'))::int", "readyToPublish")
        .addSelect("count(*) FILTER (WHERE p.status = 'approved')::int", "approved")
        .addSelect(
            "count(*) FILTER (WHERE p.status = 'published' AND p.published_at >= now() - interval '30 days')::int",
            "published30",
        )
        .where("p.workspace_id = :workspaceId", { workspaceId })
        .getRawOne<Omit<WorkbenchFigures, "credits30">>()
    return counts === undefined ? undefined : { ...counts, credits30: credits?.credits30 ?? 0 }
}
