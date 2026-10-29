import { Injectable } from "@nestjs/common"
import { In, LessThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { parseJsonText } from "@modules/platform/primitives"
import { VideoRendersError, VideoRendersErrorCode } from "./errors/video-renders.error"
import { MAX_OPEN_RENDERS } from "./video-renders.contracts"
import type { CompletedRenderMedia, NewRender, RenderClaim, RenderDone, RenderStatus } from "./video-renders.contracts"
import { VideoRenderEntity } from "./persistence/entities"
import type { VideoRenderState } from "./persistence/entities"

/** Only renderer stage codes may leave the capability. */
const RENDER_STAGES = new Set(["tts", "scenes", "mix", "encode", "poster", "upload"])

/** Converts stored render lifecycle states to the job contract. */
const RENDER_STATUSES: Record<VideoRenderState, RenderStatus["status"]> = {
    queued: "queued",
    rendering: "running",
    done: "succeeded",
    failed: "failed",
}

/** The states in which a render still waits or runs. */
const OPEN_STATES: ReadonlyArray<VideoRenderState> = ["queued", "rendering"]

/** The most selected media one lookup returns. */
const FIND_MEDIA_MAX = 80

/** One completed render offered as content media, as the media query selects it. */
interface CompletedRenderMediaRow {
    /** The render id. */
    readonly id: string
    /** The project title or fallback brand name. */
    readonly title: string
    /** The non-null video output path. */
    readonly output_path: string
    /** The video duration, when recorded. */
    readonly duration_ms: number | null
    /** When the render was queued. */
    readonly created_at: Date | string
}

/** The most recent project title of the render, or the brand name of its spec, or empty. */
const MEDIA_TITLE = `COALESCE((SELECT p.title FROM public.video_projects p
    WHERE p.workspace_id = r.workspace_id AND (p.render_id = r.id OR r.id = ANY(p.render_ids))
    ORDER BY p.updated_at DESC LIMIT 1), r.spec #>> '{brand,name}', '')`

/** Maps one completed render row to attachable media. */
const toCompletedMedia = (row: CompletedRenderMediaRow): CompletedRenderMedia => ({
    id: row.id,
    title: row.title,
    outputPath: row.output_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
})

/** The claimed render as the update's `RETURNING` clause answers it. */
interface ClaimedRenderRaw {
    /** The render id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The spec the render runs. */
    readonly spec: unknown
    /** The counters kept on the render. */
    readonly meta: RenderMetaRaw
}

/** The counters kept in the meta of a render. */
interface RenderMetaRaw {
    /** How many times it was claimed. */
    readonly attempts: number
}

@Injectable()
/** The `video_renders` rows reached only through the primary EntityManager: a render is queued by the video capability's transaction and settled by the render job. */
export class VideoRendersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes a queued render in the caller's transaction and answers its id; a workspace that already has the most open renders is refused. */
    async open(manager: EntityManager, render: NewRender): Promise<string> {
        const specRead = parseJsonText(render.spec)
        if (!specRead.ok) throw new VideoRendersError({ code: VideoRendersErrorCode.JsonUnreadable })
        const open = await manager.count(VideoRenderEntity, {
            where: { workspaceId: render.workspaceId, status: In([...OPEN_STATES]) },
        })
        if (open >= MAX_OPEN_RENDERS) {
            throw new VideoRendersError({
                code: VideoRendersErrorCode.TooMany,
                params: { workspaceId: render.workspaceId },
            })
        }
        const result = await manager.insert(VideoRenderEntity, {
            workspaceId: render.workspaceId,
            spec: specRead.value as object,
            createdBy: render.createdBy,
        })
        const id = (result.identifiers[0] as { readonly id?: string } | undefined)?.id
        if (id === undefined) throw new VideoRendersError({ code: VideoRendersErrorCode.NotWritten })
        return id
    }

    /** Takes one delivery of a render job; null when the render is already done or failed, or does not exist. */
    async claim(renderId: string): Promise<RenderClaim> {
        const result = await this.entityManager
            .createQueryBuilder(VideoRenderEntity, "v")
            .update()
            .set({
                status: "rendering",
                startedAt: () => "COALESCE(started_at, now())",
                error: null,
                meta: () => "jsonb_set(meta, '{attempts}', to_jsonb(COALESCE((meta ->> 'attempts')::int, 0) + 1))",
            })
            .where("id = :renderId AND status IN (:...open)", { renderId, open: OPEN_STATES })
            .returning(["id", "workspace_id", "spec", "meta"])
            .execute()
        const [row] = result.raw as Array<ClaimedRenderRaw>
        if (row === undefined) return null
        return { renderId: row.id, workspaceId: row.workspace_id, spec: row.spec, attempts: row.meta.attempts }
    }

    /** Records the progress of a running render, 0..99. */
    async reportProgress(renderId: string, percent: number, stage: string): Promise<void> {
        const progress = Math.max(0, Math.min(99, Math.round(percent)))
        await this.entityManager.update(
            VideoRenderEntity,
            { id: renderId, status: In([...OPEN_STATES]), progress: LessThanOrEqual(progress) },
            { status: "rendering", progress, stage },
        )
    }

    /** Settles a render as done in the caller's transaction. */
    async complete(manager: EntityManager, renderId: string, done: RenderDone): Promise<void> {
        await manager
            .createQueryBuilder(VideoRenderEntity, "v")
            .update()
            .set({
                status: "done",
                progress: 100,
                stage: null,
                outputPath: done.outputPath,
                posterPath: done.posterPath,
                durationMs: done.durationMs,
                sizeBytes: String(done.sizeBytes),
                error: null,
                meta: () => "meta || CAST(:report AS jsonb)",
                finishedAt: () => "now()",
            })
            .where("id = :renderId AND status IN (:...open)", { renderId, open: OPEN_STATES })
            .setParameter("report", JSON.stringify(done.meta))
            .execute()
    }

    /** Settles a render as failed in the caller's transaction. */
    async fail(manager: EntityManager, renderId: string, reason: string): Promise<void> {
        await manager
            .createQueryBuilder(VideoRenderEntity, "v")
            .update()
            .set({ status: "failed", error: () => "left(:reason, 300)", finishedAt: () => "now()" })
            .where("id = :renderId AND status IN (:...open)", { renderId, open: OPEN_STATES })
            .setParameter("reason", reason)
            .execute()
    }

    /** Reads the render inside a workspace after the caller has proved membership. */
    async getStatus(workspaceId: string, renderId: string): Promise<RenderStatus> {
        const row = await this.entityManager.findOne(VideoRenderEntity, {
            select: {
                id: true,
                status: true,
                progress: true,
                stage: true,
                outputPath: true,
                posterPath: true,
                durationMs: true,
                sizeBytes: true,
            },
            where: { workspaceId, id: renderId },
        })
        if (row === null) {
            throw new VideoRendersError({ code: VideoRendersErrorCode.NotFound, params: { renderId } })
        }
        return {
            id: row.id,
            status: RENDER_STATUSES[row.status],
            progress: row.progress,
            stage: row.stage !== null && RENDER_STAGES.has(row.stage) ? row.stage : null,
            outputPath: row.outputPath,
            posterPath: row.posterPath,
            durationMs: row.durationMs,
            sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
            errorCode: row.status === "failed" ? "VIDEO_RENDER_FAILED" : null,
        }
    }

    /** Lists completed media inside a workspace after the caller has proved membership. */
    async listCompletedMedia(workspaceId: string, limit: number = 10): Promise<ReadonlyArray<CompletedRenderMedia>> {
        const rows = await this.completedMedia(workspaceId)
            .limit(Math.max(1, Math.min(100, Math.trunc(limit))))
            .getRawMany<CompletedRenderMediaRow>()
        return rows.map(toCompletedMedia)
    }

    /** Finds selected completed media inside a workspace after the caller has proved membership. */
    async findCompletedMedia(
        workspaceId: string,
        ids: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<CompletedRenderMedia>> {
        if (ids.length === 0) return []
        const rows = await this.completedMedia(workspaceId)
            .andWhere("r.id IN (:...ids)", { ids: [...new Set(ids)].slice(0, FIND_MEDIA_MAX) })
            .limit(FIND_MEDIA_MAX)
            .getRawMany<CompletedRenderMediaRow>()
        return rows.map(toCompletedMedia)
    }

    /** The done renders of a workspace that have an output, newest first, selecting title and file facts. */
    private completedMedia(workspaceId: string) {
        return this.entityManager
            .createQueryBuilder(VideoRenderEntity, "r")
            .select("r.id", "id")
            .addSelect(MEDIA_TITLE, "title")
            .addSelect("r.output_path", "output_path")
            .addSelect("r.duration_ms", "duration_ms")
            .addSelect("r.created_at", "created_at")
            .where("r.workspaceId = :workspaceId", { workspaceId })
            .andWhere("r.status = :done", { done: "done" })
            .andWhere("r.outputPath IS NOT NULL")
            .orderBy("r.created_at", "DESC")
            .addOrderBy("r.id", "DESC")
    }
}
