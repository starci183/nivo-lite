import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { VideoWorkbenchService } from "./video-workbench.service"
import type { WorkbenchProject } from "./video-workbench.contracts"

@Injectable()
/** A manager's approve button creates and decides the publish_video gate for the selected render. */
export class VideoApprovalService {
    constructor(
        private readonly workbench: VideoWorkbenchService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Approves a ready render through the authority gate and returns its saved project. */
    async approve(principalId: string, workspaceId: string, projectId: string): Promise<WorkbenchProject> {
        const { member, project } = await this.workbench.managed(principalId, workspaceId, projectId)
        if (["approved", "published"].includes(project.status)) return project
        if (project.status !== "ready" || project.render?.status !== "done") {
            throw new VideoError({ code: VideoErrorCode.NotApproved })
        }
        const ctx = { workspaceId, actor: member.displayName, locale: "vi" as const }
        const item = await this.engine.runWork(ctx, {
            action: "publish_video",
            subject_type: "video_project",
            subject_id: projectId,
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
            dedupeKey: `publish_video:${projectId}:${project.render.id}`,
            seed: {
                summary: project.title,
                draft: project.script.map((scene) => scene.caption).join("\n"),
                fields: { project_id: projectId, render_id: project.render.id, title: project.title },
            },
        })
        if (item.status === "waiting_decision") {
            const done = await this.engine.resumeWork(
                ctx,
                item.id,
                "approved",
                {},
                { name: member.displayName, kind: "owner" },
            )
            if (done.status !== "done") throw new VideoError({ code: VideoErrorCode.NotApproved })
        } else if (item.status !== "done") throw new VideoError({ code: VideoErrorCode.NotApproved })
        return this.workbench.get(principalId, workspaceId, projectId)
    }
}
