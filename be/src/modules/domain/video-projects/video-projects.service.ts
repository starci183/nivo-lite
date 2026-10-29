import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { VideoBrandKitEntity } from "@modules/domain/video-brand-kits"
import { VideoRenderEntity } from "@modules/domain/video-renders"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import type { ProjectLookup, RenderStart } from "./video-projects.contracts"
import { VideoProjectEntity } from "./persistence/entities"

/** The project to render with everything the spec needs, as the joined read selects it. */
interface ProjectRenderRaw {
    /** The project id. */
    readonly id: string
    /** The workspace it belongs to. */
    readonly workspace_id: string
    /** The output shape. */
    readonly aspect: string
    /** The project status. */
    readonly status: string
    /** The editable scenes, as stored. */
    readonly script: unknown
    /** The version the next render snapshots. */
    readonly version: number
    /** The status of the render the project points at, or null. */
    readonly render_status: string | null
    /** The workspace name. */
    readonly workspace_name: string
    /** The brand kit shop name; null without a kit. */
    readonly shop_name: string | null
    /** The brand kit primary colour. */
    readonly primary_color: string | null
    /** The brand kit secondary colour. */
    readonly secondary_color: string | null
    /** The brand kit logo path in the media bucket. */
    readonly logo_path: string | null
    /** The brand kit music track. */
    readonly music_track: string | null
    /** The brand kit voice. */
    readonly voice: string | null
}

@Injectable()
/** The `video_projects` rows: the project a render starts from, locked in the transaction that queues the render, and the status the render leaves it in. */
export class VideoProjectsService {
    /** The project with its brand kit, locked in the caller's transaction; null when it does not exist. */
    async forRender(manager: EntityManager, projectId: string): Promise<ProjectLookup> {
        const row = await manager
            .createQueryBuilder(VideoProjectEntity, "p")
            .innerJoin(WorkspaceEntity, "w", "w.id = p.workspaceId")
            .leftJoin(VideoBrandKitEntity, "k", "k.workspaceId = p.workspaceId")
            .leftJoin(VideoRenderEntity, "r", "r.id = p.renderId")
            .select([
                "p.id AS id",
                "p.workspace_id AS workspace_id",
                "p.aspect AS aspect",
                "p.status AS status",
                "p.script AS script",
                "p.version AS version",
                "r.status AS render_status",
                "w.name AS workspace_name",
                "k.shop_name AS shop_name",
                "k.primary_color AS primary_color",
                "k.secondary_color AS secondary_color",
                "k.logo_path AS logo_path",
                "k.music_track AS music_track",
                "k.voice AS voice",
            ])
            .where("p.id = :projectId", { projectId })
            .limit(1)
            .setLock("pessimistic_write", undefined, ["p"])
            .getRawOne<ProjectRenderRaw>()
        if (row === undefined) return null
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            aspect: row.aspect,
            status: row.status,
            script: row.script,
            version: row.version,
            renderStatus: row.render_status,
            workspaceName: row.workspace_name,
            brand: {
                shopName: row.shop_name,
                primary: row.primary_color,
                secondary: row.secondary_color,
                logoPath: row.logo_path,
                musicTrack: row.music_track,
                voice: row.voice,
            },
        }
    }

    /**
     * Points the project at its new render and opens its next version, in the caller's transaction; an earlier approval no longer
     * holds.
     */
    async startRender(manager: EntityManager, start: RenderStart): Promise<void> {
        await manager
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({
                status: "rendering",
                renderId: start.renderId,
                renderIds: () => "array_append(render_ids, CAST(:appendedRenderId AS uuid))",
                currentSpec: () => "CAST(:spec AS jsonb)",
                version: () => "version + 1",
                lastError: null,
                approvedAt: null,
                approvedByName: null,
                publishedAt: null,
            })
            .where("id = :projectId", { projectId: start.projectId })
            .setParameters({ appendedRenderId: start.renderId, spec: start.spec })
            .execute()
    }

    /** Makes the project of a finished render ready to approve, in the caller's transaction. */
    async markReady(manager: EntityManager, renderId: string): Promise<void> {
        await manager.update(
            VideoProjectEntity,
            { renderId, status: "rendering" },
            { status: "ready", lastError: null },
        )
    }

    /** Sends the project of a failed render back to draft with the reason, in the caller's transaction. */
    async markDraft(manager: EntityManager, renderId: string, reason: string): Promise<void> {
        await manager.update(
            VideoProjectEntity,
            { renderId, status: "rendering" },
            { status: "draft", lastError: reason },
        )
    }
}
