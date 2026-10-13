import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { VideoRendersError, VideoRendersErrorCode } from "./errors/video-renders.error"
import { MAX_OPEN_RENDERS } from "./video-renders.contracts"
import type { NewRender, RenderClaim, RenderDone } from "./video-renders.contracts"
import {
    CLAIM_RENDER,
    COMPLETE_RENDER,
    COUNT_OPEN_RENDERS,
    FAIL_RENDER,
    INSERT_RENDER,
    UPDATE_RENDER_PROGRESS,
} from "./persistence/video-renders.sql"
import type { ClaimedRenderRow, InsertedRenderRow, OpenRendersRow } from "./persistence/video-renders.rows"

@Injectable()
/** The `video_renders` rows reached only through the primary EntityManager: a render is queued by the video capability's transaction and settled by the render job. */
export class VideoRendersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes a queued render in the caller's transaction and answers its id; a workspace that already has the most open renders is refused. */
    async open(manager: EntityManager, render: NewRender): Promise<string> {
        const [open] = await manager.query<Array<OpenRendersRow>>(COUNT_OPEN_RENDERS, [render.workspaceId])
        if ((open?.open ?? 0) >= MAX_OPEN_RENDERS) {
            throw new VideoRendersError({
                code: VideoRendersErrorCode.TooMany,
                params: { workspaceId: render.workspaceId },
            })
        }
        const [row] = await manager.query<Array<InsertedRenderRow>>(INSERT_RENDER, [
            render.workspaceId,
            render.spec,
            render.createdBy,
        ])
        if (row === undefined) throw new VideoRendersError({ code: VideoRendersErrorCode.NotWritten })
        return row.id
    }

    /** Takes one delivery of a render job; null when the render is already done or failed, or does not exist. */
    async claim(renderId: string): Promise<RenderClaim> {
        const [row] = await this.entityManager.query<Array<ClaimedRenderRow>>(CLAIM_RENDER, [renderId])
        if (row === undefined) return null
        return { renderId: row.id, workspaceId: row.workspace_id, spec: row.spec, attempts: row.attempts }
    }

    /** Records the progress of a running render, 0..99. */
    async reportProgress(renderId: string, percent: number, stage: string): Promise<void> {
        const progress = Math.max(0, Math.min(99, Math.round(percent)))
        await this.entityManager.query(UPDATE_RENDER_PROGRESS, [renderId, progress, stage])
    }

    /** Settles a render as done in the caller's transaction. */
    async complete(manager: EntityManager, renderId: string, done: RenderDone): Promise<void> {
        await manager.query(COMPLETE_RENDER, [
            renderId,
            done.outputPath,
            done.posterPath,
            done.durationMs,
            done.sizeBytes,
            JSON.stringify(done.meta),
        ])
    }

    /** Settles a render as failed in the caller's transaction. */
    async fail(manager: EntityManager, renderId: string, reason: string): Promise<void> {
        await manager.query(FAIL_RENDER, [renderId, reason])
    }
}
