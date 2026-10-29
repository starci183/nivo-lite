import { Injectable } from "@nestjs/common"
import { In, LessThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { VideoRendersError, VideoRendersErrorCode } from "./errors/video-renders.error"
import { MAX_OPEN_RENDERS } from "./video-renders.contracts"
import type {
    CompletedRenderMedia,
    NewRender,
    RenderClaim,
    RenderDone,
    RenderFacts,
    OptionalRenderState,
    OptionalSettledRender,
    RenderStatus,
} from "./video-renders.contracts"
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

/** The states in which a render is settled. */
const SETTLED_STATES: ReadonlyArray<VideoRenderState> = ["done", "failed"]

/** A text a render recorded in its meta, or null when it recorded none. */
const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The states in which a render still waits or runs. */
const OPEN_STATES: ReadonlyArray<VideoRenderState> = ["queued", "rendering"]

/** The most selected media one lookup returns. */
const FIND_MEDIA_MAX = 80

/** One completed render offered as content media, as the media query selects it. */
interface CompletedRenderMediaRow {
    /** The render id. */
    readonly id: string
    /** The brand name of the spec, when it names one. */
    readonly brand_name: string | null
    /** The non-null video output path. */
    readonly output_path: string
    /** The video duration, when recorded. */
    readonly duration_ms: number | null
    /** When the render was queued. */
    readonly created_at: Date | string
}

/** Maps one completed render row to attachable media, titled by the newest project that holds it, else by the brand of its spec, else empty. */
const toCompletedMedia = (row: CompletedRenderMediaRow, projectTitle: string | undefined): CompletedRenderMedia => ({
    id: row.id,
    title: projectTitle ?? row.brand_name ?? "",
    outputPath: row.output_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
})

/** The most renders one workbench read holds. */
const FACTS_MAX = 500

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

/** True when a RETURNING row carries what claiming a render needs. */
const isClaimedRender = (value: unknown): value is ClaimedRenderRaw =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspace_id === "string" &&
    isRecord(value.meta) &&
    typeof value.meta.attempts === "number"

@Injectable()
/** The `video_renders` rows reached only through the primary EntityManager: a render is queued by the video capability's transaction and settled by the render job. */
export class VideoRendersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly projects: VideoProjectsService,
    ) {}

    /** Writes a queued render in the caller's transaction and answers its id; a workspace that already has the most open renders is refused. */
    async open(manager: EntityManager, render: NewRender): Promise<string> {
        const specRead = parseJsonText(render.spec)
        if (!specRead.ok || typeof specRead.value !== "object" || specRead.value === null) throw new VideoRendersError({ code: VideoRendersErrorCode.JsonUnreadable })
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
            spec: specRead.value,
            createdBy: render.createdBy,
        })
        const id: unknown = result.identifiers[0]?.id
        if (typeof id !== "string") throw new VideoRendersError({ code: VideoRendersErrorCode.NotWritten })
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
        const row = Array.isArray(result.raw) ? result.raw.find(isClaimedRender) : undefined
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
        return this.titled(workspaceId, rows)
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
        return this.titled(workspaceId, rows)
    }

    /** The raw status text of a render; null when there is no such render. */
    async stateOf(renderId: string): Promise<OptionalRenderState> {
        const row = await this.entityManager.findOne(VideoRenderEntity, {
            select: { status: true },
            where: { id: renderId },
        })
        return row?.status ?? null
    }

    /** Whether a render of the workspace finished: a done render never changes again. */
    isDone(workspaceId: string, renderId: string): Promise<boolean> {
        return this.entityManager.exists(VideoRenderEntity, { where: { id: renderId, workspaceId, status: "done" } })
    }

    /** What the workbench shows of the given renders of the workspace; an id that is no render of the workspace is missing from the answer. */
    async factsOf(workspaceId: string, renderIds: ReadonlyArray<string>): Promise<Array<RenderFacts>> {
        if (renderIds.length === 0) return []
        const renders = await this.entityManager.find(VideoRenderEntity, {
            select: {
                id: true,
                status: true,
                progress: true,
                stage: true,
                durationMs: true,
                sizeBytes: true,
                outputPath: true,
                posterPath: true,
                meta: true,
            },
            where: { workspaceId, id: In([...new Set(renderIds)]) },
            take: FACTS_MAX,
        })
        return renders.map((render) => ({
            id: render.id,
            status: render.status,
            progress: render.progress,
            stage: render.stage,
            durationMs: render.durationMs,
            sizeBytes: render.sizeBytes === null ? null : Number(render.sizeBytes),
            outputPath: render.outputPath,
            posterPath: render.posterPath,
            captionsPath: textOf(render.meta.captions_path),
            captionsLang: textOf(render.meta.captions_lang),
        }))
    }

    /** A done or failed render of the workspace with what a delegation card shows; null when it is still open or is no render of the workspace. */
    async settledOf(workspaceId: string, renderId: string): Promise<OptionalSettledRender> {
        const render = await this.entityManager.findOne(VideoRenderEntity, {
            select: {
                id: true,
                status: true,
                durationMs: true,
                outputPath: true,
                posterPath: true,
                error: true,
                meta: true,
            },
            where: { id: renderId, workspaceId, status: In([...SETTLED_STATES]) },
        })
        if (render === null) return null
        return {
            id: render.id,
            status: render.status,
            durationMs: render.durationMs,
            outputPath: render.outputPath,
            posterPath: render.posterPath,
            captionsPath: textOf(render.meta.captions_path),
            captionsLang: textOf(render.meta.captions_lang),
            voiceover: textOf(render.meta.voiceover),
            error: render.error,
        }
    }

    /** Titles the completed media rows by the newest project that holds each render. */
    private async titled(
        workspaceId: string,
        rows: ReadonlyArray<CompletedRenderMediaRow>,
    ): Promise<Array<CompletedRenderMedia>> {
        const titles = await this.projects.titlesOfRenders(
            workspaceId,
            rows.map((row) => row.id),
        )
        const titleOf = new Map(titles.map((entry) => [entry.renderId, entry.title]))
        return rows.map((row) => toCompletedMedia(row, titleOf.get(row.id)))
    }

    /** The done renders of a workspace that have an output, newest first, selecting title and file facts. */
    private completedMedia(workspaceId: string) {
        return this.entityManager
            .createQueryBuilder(VideoRenderEntity, "r")
            .select("r.id", "id")
            .addSelect("r.spec #>> '{brand,name}'", "brand_name")
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
