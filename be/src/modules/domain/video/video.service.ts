import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoProjectVersionsService } from "@modules/domain/video-project-versions"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { RenderDone } from "@modules/domain/video-renders"
import { VideoRenderQueue } from "@modules/queues/video-render"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { RenderQueued } from "./video.contracts"
import { readScript, specOf } from "./video-script.policy"
import { validateVideoSpec } from "./video-spec.policy"

/** The render statuses that keep a project busy. */
const OPEN_RENDER_STATUSES: ReadonlyArray<string | null> = ["queued", "rendering"]

@Injectable()
/**
 * The video use cases that span the project, the render and the version rows. A render is queued with its version, the project's new status and
 * its render-video job in one transaction; a finished or failed render settles the render row and its project in one transaction.
 */
export class VideoService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly projects: VideoProjectsService,
        private readonly versions: VideoProjectVersionsService,
        private readonly renders: VideoRendersService,
        private readonly queue: VideoRenderQueue,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /**
     * Queues a render of a project of the caller: the spec is built from the script and the brand kit and validated, then the render row, the
     * project version, the project's new status and the render-video job are written in one transaction, so the job exists exactly when the
     * render does. Only an owner or manager of the workspace may render (the workspace-members capability refuses anyone else).
     */
    requestRender(principalId: string, projectId: string): Promise<RenderQueued> {
        return this.entityManager.transaction(async (manager) => {
            const project = await this.projects.forRender(manager, projectId)
            if (project === null) {
                throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId } })
            }
            await this.members.require(principalId, project.workspaceId, ["owner", "manager"])
            if (project.status === "scripting" || OPEN_RENDER_STATUSES.includes(project.renderStatus)) {
                throw new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId } })
            }
            const saved = project.brand.shopName
            const brand = {
                shopName: saved === null || saved === "" ? project.workspaceName : saved,
                primary: project.brand.primary ?? "",
                secondary: project.brand.secondary ?? "",
                logoPath: project.brand.logoPath,
                musicTrack: project.brand.musicTrack,
                voice: project.brand.voice ?? "",
            }
            const scenes = readScript(project.script)
            const raw = specOf(scenes, project.aspect, brand, this.catalog.get("video.brand.fallback", {}, "vi"))
            const checked = validateVideoSpec(raw, { workspaceId: project.workspaceId })
            if (!checked.ok) {
                throw new VideoError({
                    code: VideoErrorCode.SpecInvalid,
                    params: { reason: checked.errors.slice(0, 2).join("; ") },
                })
            }
            const spec = JSON.stringify(checked.spec)
            const renderId = await this.renders.open(manager, {
                workspaceId: project.workspaceId,
                spec,
                createdBy: principalId,
            })
            await this.versions.record(manager, {
                projectId: project.id,
                workspaceId: project.workspaceId,
                version: project.version,
                script: JSON.stringify(project.script),
                spec,
                renderId,
                createdBy: principalId,
            })
            await this.projects.startRender(manager, { projectId: project.id, renderId, spec })
            await this.queue.enqueueRenderVideo({ renderId }, manager)
            return { renderId, projectId: project.id }
        })
    }

    /** Settles a render as done and makes its project ready to approve, in one transaction. */
    async completeRender(renderId: string, done: RenderDone): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await this.renders.complete(manager, renderId, done)
            await this.projects.markReady(manager, renderId)
        })
    }

    /** Settles a render as failed and sends its project back to draft with the reason, in one transaction. */
    async failRender(renderId: string, reason: string): Promise<void> {
        const shown = this.catalog.get("video.render.failed", { reason: reason.slice(0, 200) }, "vi")
        await this.entityManager.transaction(async (manager) => {
            await this.renders.fail(manager, renderId, reason)
            await this.projects.markDraft(manager, renderId, shown)
        })
    }
}
