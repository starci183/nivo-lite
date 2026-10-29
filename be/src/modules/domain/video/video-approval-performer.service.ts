import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    WorkPerformerRegistry,
    WorkPerformer,
    WorkContext,
    WorkItem,
    Proposal,
    Prepared,
    Performed,
    PerformedBy,
} from "@modules/domain/decisions"
import { VideoError, VideoErrorCode } from "./errors/video.error"

@Injectable()
/** The publish_video effect runs only after a person approves through the authority gate. */
export class VideoApprovalPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        private readonly writer: VideoProjectWorkbenchWriterService,
        private readonly renders: VideoRendersService,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
    ) {}

    /** Registers the video authority effect with the work engine. */
    onModuleInit(): void {
        this.registry.add("publish_video", this)
    }

    /** Approval uses the proposed video summary as saved. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Validates the selected render, which must be a finished one, and records the human approval once. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const renderId = proposal.fields.render_id
        if (
            !("kind" in by) ||
            !["owner", "staff"].includes(by.kind) ||
            item.subject_type !== "video_project" ||
            item.subject_id === null ||
            typeof renderId !== "string"
        ) {
            throw new VideoError({ code: VideoErrorCode.NotApproved })
        }
        const finished = await this.renders.isDone(ctx.workspaceId, renderId)
        const changed = finished && (await this.writer.approve(ctx.workspaceId, item.subject_id, renderId, by.name))
        if (!changed) throw new VideoError({ code: VideoErrorCode.NotApproved })
        return {
            summary: proposal.summary,
            evidence: "captured",
            href: `/agents/video/workbench?focus=${item.subject_id}`,
        }
    }
}
