import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ProjectLookup, RenderStart } from "./video-projects.contracts"
import {
    DRAFT_PROJECT,
    MARK_PROJECT_RENDERING,
    READY_PROJECT,
    SELECT_PROJECT_FOR_RENDER,
} from "./persistence/video-projects.sql"
import type { ProjectRenderRow } from "./persistence/video-projects.rows"

@Injectable()
/** The `video_projects` rows: the project a render starts from, locked in the transaction that queues the render, and the status the render leaves it in. */
export class VideoProjectsService {
    /** The project with the caller's role and the brand kit, locked in the caller's transaction; null when it does not exist or the caller is no member of its workspace. */
    async forRender(manager: EntityManager, projectId: string, principalId: string): Promise<ProjectLookup> {
        const [row] = await manager.query<Array<ProjectRenderRow>>(SELECT_PROJECT_FOR_RENDER, [projectId, principalId])
        if (row === undefined) return null
        return {
            id: row.id,
            workspaceId: row.workspace_id,
            aspect: row.aspect,
            status: row.status,
            script: row.script,
            version: row.version,
            role: row.role,
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

    /** Points the project at its new render and opens its next version, in the caller's transaction. */
    async startRender(manager: EntityManager, start: RenderStart): Promise<void> {
        await manager.query(MARK_PROJECT_RENDERING, [start.projectId, start.renderId, start.spec])
    }

    /** Makes the project of a finished render ready to approve, in the caller's transaction. */
    async markReady(manager: EntityManager, renderId: string): Promise<void> {
        await manager.query(READY_PROJECT, [renderId])
    }

    /** Sends the project of a failed render back to draft with the reason, in the caller's transaction. */
    async markDraft(manager: EntityManager, renderId: string, reason: string): Promise<void> {
        await manager.query(DRAFT_PROJECT, [renderId, reason])
    }
}
