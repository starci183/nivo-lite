import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AiGenerationsError, GenerationsService } from "@modules/domain/ai-generations"
import type { GenMessage, GenerationState } from "@modules/domain/ai-generations"
import { EventsService } from "@modules/domain/events"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { parseVideoScript } from "./video-scripting.policy"
import { VIDEO_SCRIPT_RETRY } from "./video-scripting.templates"
import { videoInputsOf, videoRecord } from "./video-workbench.policy"
import type { VideoScriptingRow } from "./persistence/video-scripting.rows"
import { LOCK_SCRIPT_PROJECT } from "./persistence/video-scripting.sql"

/** Whether a stored entry is a chat message the model can be sent again. */
const isMessage = (entry: unknown): entry is GenMessage => {
    const message = videoRecord(entry)
    return ["system", "user", "assistant"].includes(String(message.role)) && typeof message.content === "string"
}

@Injectable()
/** Applies an agent answer once, or queues one JSON correction attempt, while holding the project lock. */
export class VideoScriptingCompletionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly generations: GenerationsService,
        private readonly events: EventsService,
        private readonly projectWriter: VideoProjectScriptingService,
    ) {}

    /** Completes only video-script generations that still own the project; queue redelivery is safe. */
    async complete(workspaceId: string, generationId: string): Promise<void> {
        const state = await this.generations.state(workspaceId, generationId)
        const projectId = state === null ? undefined : videoRecord(state.input.context).projectId
        if (
            state?.purpose !== "video_script" ||
            typeof projectId !== "string" ||
            state.status === "queued" ||
            state.status === "running"
        )
            return
        await this.entityManager.transaction(async (tx) => {
            const [project] = await tx.query<Array<VideoScriptingRow>>(LOCK_SCRIPT_PROJECT, [workspaceId, projectId])
            if (project?.status !== "scripting") return
            const meta = videoRecord(project.script_meta)
            if (meta.generation_id !== generationId || typeof meta.script_request_id !== "string") return
            if (state.status !== "done" || state.text === null) {
                await this.fail(tx, workspaceId, project, state, meta, "VIDEO_SCRIPT_FAILED")
                return
            }
            const parsed = parseVideoScript(state.text, generationId, workspaceId)
            if (parsed === null) {
                if (meta.attempts === 1 && (await this.retry(tx, workspaceId, project, state, meta))) return
                await this.fail(tx, workspaceId, project, state, meta, "VIDEO_SCRIPT_FORMAT")
                return
            }
            const media = videoInputsOf(project.inputs, workspaceId).media
            const scenes = parsed.scenes.map((scene, index) => ({
                ...scene,
                media: media[index % media.length] ?? null,
            }))
            const now = this.clock.now()
            const elapsed =
                typeof meta.started_at === "string" ? Math.max(0, now.getTime() - Date.parse(meta.started_at)) : 0
            await this.projectWriter.finish(tx, {
                workspaceId,
                projectId: project.id,
                generationId,
                script: JSON.stringify(scenes),
                durationMs: Number.isFinite(elapsed) ? elapsed : 0,
                title: meta.auto_title === true && parsed.title !== "" ? parsed.title : null,
                meta: JSON.stringify({ ...meta, timings: state.timings, finished_at: now.toISOString() }),
            })
            await this.generations.recordResult(workspaceId, meta.script_request_id, { projectId: project.id }, tx)
            await this.events.record(
                {
                    workspaceId,
                    kind: "video.script_generated",
                    actor: "OpenClaw",
                    summary: this.catalog.get(
                        "video.script.generated",
                        { title: parsed.title || project.title, scenes: scenes.length },
                        "vi",
                    ),
                    evidence: scenes.map((scene, index) => `${index + 1}. ${scene.caption}`).join("\n"),
                },
                tx,
            )
        })
    }

    private async retry(
        tx: EntityManager,
        workspaceId: string,
        project: VideoScriptingRow,
        state: GenerationState,
        meta: Record<string, unknown>,
    ): Promise<boolean> {
        const messages = Array.isArray(state.input.messages) ? state.input.messages.filter(isMessage) : []
        try {
            const queued = await this.generations.request(
                {
                    workspaceId,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: [...messages, { role: "user", content: VIDEO_SCRIPT_RETRY }],
                },
                { projectId: project.id, requestId: meta.script_request_id },
                tx,
            )
            await this.projectWriter.start(
                tx,
                workspaceId,
                project.id,
                JSON.stringify({ ...meta, generation_id: queued.id, attempts: 2 }),
            )
            return true
        } catch (cause) {
            if (!(cause instanceof AiGenerationsError)) throw cause
            return false
        }
    }

    private async fail(
        tx: EntityManager,
        workspaceId: string,
        project: VideoScriptingRow,
        state: GenerationState,
        meta: Record<string, unknown>,
        code: string,
    ): Promise<void> {
        if (typeof meta.script_request_id !== "string") return
        await this.projectWriter.fail(tx, {
            workspaceId,
            projectId: project.id,
            generationId: state.id,
            code: `code:${code}`,
            meta: JSON.stringify({ ...meta, finished_at: this.clock.now().toISOString() }),
        })
        await this.generations.recordFailure(workspaceId, meta.script_request_id, code, tx)
    }
}
