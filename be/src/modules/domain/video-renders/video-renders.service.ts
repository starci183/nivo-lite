import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { VideoRendersError, VideoRendersErrorCode } from "./errors/video-renders.error"
import { MAX_OPEN_RENDERS } from "./video-renders.contracts"
import type { CompletedRenderMedia, NewRender, RenderClaim, RenderDone, RenderStatus } from "./video-renders.contracts"
import {
    CLAIM_RENDER,
    COMPLETE_RENDER,
    COUNT_OPEN_RENDERS,
    FAIL_RENDER,
    FIND_COMPLETED_RENDER_MEDIA,
    INSERT_RENDER,
    LIST_COMPLETED_RENDER_MEDIA,
    SELECT_RENDER_STATUS,
    UPDATE_RENDER_PROGRESS,
} from "./persistence/video-renders.sql"
import type {
    ClaimedRenderRow,
    CompletedRenderMediaRow,
    InsertedRenderRow,
    OpenRendersRow,
    RenderStatusRow,
} from "./persistence/video-renders.rows"

/** Only renderer stage codes may leave the capability. */
const RENDER_STAGES = new Set(["tts", "scenes", "mix", "encode", "poster", "upload"])

/** Converts stored render lifecycle states to the job contract. */
const RENDER_STATUSES: Record<RenderStatusRow["status"], RenderStatus["status"]> = {
    queued: "queued",
    rendering: "running",
    done: "succeeded",
    failed: "failed",
}

/** Maps one completed render row to attachable media. */
const toCompletedMedia = (row: CompletedRenderMediaRow): CompletedRenderMedia => ({
    id: row.id,
    title: row.title,
    outputPath: row.output_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
})

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

    /** Reads the render inside a workspace after the caller has proved membership. */
    async getStatus(workspaceId: string, renderId: string): Promise<RenderStatus> {
        const [row] = await this.entityManager.query<Array<RenderStatusRow>>(SELECT_RENDER_STATUS, [
            workspaceId,
            renderId,
        ])
        if (row === undefined) {
            throw new VideoRendersError({ code: VideoRendersErrorCode.NotFound, params: { renderId } })
        }
        return {
            id: row.id,
            status: RENDER_STATUSES[row.status],
            progress: row.progress,
            stage: row.stage !== null && RENDER_STAGES.has(row.stage) ? row.stage : null,
            outputPath: row.output_path,
            posterPath: row.poster_path,
            durationMs: row.duration_ms,
            sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
            errorCode: row.status === "failed" ? "VIDEO_RENDER_FAILED" : null,
        }
    }

    /** Lists completed media inside a workspace after the caller has proved membership. */
    async listCompletedMedia(workspaceId: string, limit: number = 10): Promise<ReadonlyArray<CompletedRenderMedia>> {
        const rows = await this.entityManager.query<Array<CompletedRenderMediaRow>>(LIST_COMPLETED_RENDER_MEDIA, [
            workspaceId,
            Math.max(1, Math.min(100, Math.trunc(limit))),
        ])
        return rows.map(toCompletedMedia)
    }

    /** Finds selected completed media inside a workspace after the caller has proved membership. */
    async findCompletedMedia(
        workspaceId: string,
        ids: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<CompletedRenderMedia>> {
        if (ids.length === 0) return []
        const rows = await this.entityManager.query<Array<CompletedRenderMediaRow>>(FIND_COMPLETED_RENDER_MEDIA, [
            workspaceId,
            [...new Set(ids)].slice(0, 80),
        ])
        return rows.map(toCompletedMedia)
    }
}
