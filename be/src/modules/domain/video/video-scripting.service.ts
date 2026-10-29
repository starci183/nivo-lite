import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationState } from "@modules/domain/ai-generations"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { InboxClaim } from "./video.contracts"
import type { VideoScriptRequest, VideoScriptStatus } from "./video-scripting.contracts"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { VIDEO_SCRIPT_STALE_MS, videoScriptProgress } from "./video-scripting.policy"
import { videoScriptMessages, videoScriptSourcesText } from "./video-scripting-prompt.policy"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { videoInputsOf, videoRecord } from "./video-workbench.policy"
import type { ScriptProject } from "./video-stored.contracts"
import { readScriptProject, readScriptSources } from "./persistence/video-scripting.query"

@Injectable()
/** Queues script writing with its project state, and exposes read-only progress for the workbench. */
export class VideoScriptingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly generations: GenerationsService,
        private readonly context: VideoScriptingContextService,
        private readonly projectWriter: VideoProjectScriptingService,
        private readonly completion: VideoScriptingCompletionService,
    ) {}

    /** A manager starts one fenced agent-generation job; concurrent clicks reuse its stable operation id. */
    async request(principalId: string, workspaceId: string, projectId: string): Promise<VideoScriptRequest> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        return this.entityManager.transaction(async (tx) => {
            const project = await this.project(tx, workspaceId, projectId, true)
            if (project.status === "rendering" || ["queued", "rendering"].includes(project.render_status ?? "")) {
                throw new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId } })
            }
            const meta = videoRecord(project.script_meta)
            const previous = await this.currentRequest(tx, workspaceId, project, meta)
            if (previous !== null) return previous
            const sources = await readScriptSources(
                tx,
                workspaceId,
                videoInputsOf(project.inputs, workspaceId).sourceIds,
            )
            const publicSources = videoScriptSourcesText(sources)
            const context = await this.context.forProject(tx, workspaceId, project, publicSources)
            const queued = await this.generations.request(
                {
                    workspaceId,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: videoScriptMessages(project, workspaceId, publicSources, context),
                },
                { projectId },
                tx,
            )
            await this.projectWriter.start(
                tx,
                workspaceId,
                projectId,
                JSON.stringify({
                    ...meta,
                    script_request_id: queued.id,
                    generation_id: queued.id,
                    attempts: 1,
                    started_at: this.clock.now().toISOString(),
                    finished_at: null,
                }),
            )
            return { ...queued, projectId }
        })
    }

    /** Reads a manager's script operation without performing any domain writes. */
    async status(principalId: string, workspaceId: string, id: string): Promise<VideoScriptStatus> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const state = await this.generations.state(workspaceId, id)
        const projectId = state === null ? undefined : videoRecord(state.input.context).projectId
        if (state?.purpose !== "video_script" || typeof projectId !== "string") {
            throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId: id } })
        }
        const project = await this.project(this.entityManager, workspaceId, projectId)
        const result = videoRecord(state.output.result)
        if (result.projectId === projectId) {
            return { id, projectId, status: "succeeded", progress: 100, resultId: projectId, errorCode: null }
        }
        if (state.status === "error" || state.status === "cancelled") return this.failed(id, projectId, state)
        if (this.clock.now().getTime() - Date.parse(state.createdAt) > VIDEO_SCRIPT_STALE_MS) {
            return { id, projectId, status: "failed", progress: 100, resultId: null, errorCode: "VIDEO_SCRIPT_TIMEOUT" }
        }
        const meta = videoRecord(project.script_meta)
        if (meta.script_request_id !== id) {
            return {
                id,
                projectId,
                status: "failed",
                progress: 100,
                resultId: null,
                errorCode: "VIDEO_SCRIPT_SUPERSEDED",
            }
        }
        const active =
            typeof meta.generation_id === "string" && meta.generation_id !== id
                ? await this.generations.state(workspaceId, meta.generation_id)
                : state
        return { id, projectId, ...videoScriptProgress(active?.status ?? "running"), resultId: null, errorCode: null }
    }

    /** The `video` reactor of `ai_generation_completed` calls this after the engine closes its generation row. */
    complete(workspaceId: string, generationId: string, claim: InboxClaim): Promise<void> {
        return this.completion.complete(workspaceId, generationId, claim)
    }

    private async project(
        tx: EntityManager,
        workspaceId: string,
        projectId: string,
        lock = false,
    ): Promise<ScriptProject> {
        const row = await readScriptProject(tx, workspaceId, projectId, lock)
        if (row === undefined) throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId } })
        return row
    }

    private async currentRequest(
        tx: EntityManager,
        workspaceId: string,
        project: ScriptProject,
        meta: Record<string, unknown>,
    ): Promise<VideoScriptRequest | null> {
        if (project.status !== "scripting") return null
        const started =
            typeof meta.started_at === "string" ? Date.parse(meta.started_at) : new Date(project.updated_at).getTime()
        const rootId = meta.script_request_id
        if (this.clock.now().getTime() - started <= VIDEO_SCRIPT_STALE_MS) {
            if (typeof rootId !== "string")
                throw new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId: project.id } })
            const active =
                typeof meta.generation_id === "string"
                    ? await this.generations.state(workspaceId, meta.generation_id, tx)
                    : null
            return {
                id: rootId,
                projectId: project.id,
                status: videoScriptProgress(active?.status ?? "running").status,
            }
        }
        if (typeof rootId === "string")
            await this.generations.recordFailure(workspaceId, rootId, "VIDEO_SCRIPT_TIMEOUT", tx)
        if (typeof meta.generation_id === "string" && meta.generation_id !== rootId) {
            await this.generations.recordFailure(workspaceId, meta.generation_id, "VIDEO_SCRIPT_TIMEOUT", tx)
        }
        return null
    }

    private failed(id: string, projectId: string, state: GenerationState): VideoScriptStatus {
        const code = state.errorCode?.startsWith("VIDEO_SCRIPT_") === true ? state.errorCode : "VIDEO_SCRIPT_FAILED"
        return { id, projectId, status: "failed", progress: 100, resultId: null, errorCode: code }
    }
}
