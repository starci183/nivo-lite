import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    NewVideoDelegation,
    OptionalDelegationId,
    OptionalDelegationRender,
    OptionalFailureReason,
} from "./video-delegations.contracts"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import { VideoDelegationEntity } from "./persistence/entities"

@Injectable()
/** The owner of video_delegations: the scripts other agents delegated to AI Editor and how each one came back. */
export class VideoDelegationsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly projects: VideoProjectsService,
        private readonly renders: VideoRendersService,
    ) {}

    /** The delegation a work item already made, or null. */
    async ofWorkItem(workspaceId: string, workItemId: string): Promise<OptionalDelegationId> {
        const delegation = await this.entityManager.findOne(VideoDelegationEntity, {
            select: { id: true, projectId: true },
            where: { workspaceId, workItemId },
        })
        return delegation === null ? null : { id: delegation.id, project_id: delegation.projectId }
    }

    /** Records a delegation in the caller's transaction; null when nothing was written. */
    async record(tx: EntityManager, input: NewVideoDelegation): Promise<OptionalDelegationId> {
        const result = await tx.insert(VideoDelegationEntity, {
            workspaceId: input.workspaceId,
            workItemId: input.workItemId,
            projectId: input.projectId,
            sourceModule: input.sourceModule,
            contentItemId: input.contentItemId,
            channels: [...input.channels],
        })
        const id: unknown = result.identifiers[0]?.id
        return typeof id === "string" ? { id, project_id: input.projectId } : null
    }

    /** Links the render queued for a delegation. */
    async linkRender(delegationId: string, renderId: string): Promise<void> {
        await this.entityManager.update(
            VideoDelegationEntity,
            { id: delegationId },
            { renderId, updatedAt: () => "now()" },
        )
    }

    /** The still rendering delegation of a settled render, with what its cards show; null when nobody delegated it. */
    async ofSettledRender(renderId: string): Promise<OptionalDelegationRender> {
        const delegation = await this.entityManager.findOne(VideoDelegationEntity, {
            select: {
                id: true,
                workspaceId: true,
                workItemId: true,
                projectId: true,
                sourceModule: true,
                channels: true,
            },
            where: { renderId, status: "rendering" },
        })
        if (delegation === null) return null
        const [project, render] = await Promise.all([
            this.projects.cardFactsOf(delegation.workspaceId, delegation.projectId),
            this.renders.settledOf(delegation.workspaceId, renderId),
        ])
        if (project === null || render === null) return null
        return {
            id: delegation.id,
            workspace_id: delegation.workspaceId,
            work_item_id: delegation.workItemId,
            project_id: delegation.projectId,
            source_module: delegation.sourceModule,
            channels: delegation.channels,
            title: project.title,
            aspect: project.aspect,
            script: project.script,
            render_id: render.id,
            render_status: render.status,
            duration_ms: render.durationMs,
            output_path: render.outputPath,
            poster_path: render.posterPath,
            captions_path: render.captionsPath,
            captions_lang: render.captionsLang,
            voiceover: render.voiceover,
            error: render.error,
        }
    }

    /** Settles a rendering delegation as ready (its cards go out); true only for the one call that settled it. */
    markReady(delegationId: string): Promise<boolean> {
        return this.settle(delegationId, "ready", null)
    }

    /** Settles a rendering delegation as failed with the reason; true only for the one call that settled it. */
    markFailed(delegationId: string, error: OptionalFailureReason): Promise<boolean> {
        return this.settle(delegationId, "failed", error)
    }

    /** Keeps the card AI Editor posted and the work item that decides it. */
    async saveCard(delegationId: string, approvalWorkItemId: string, card: object): Promise<void> {
        await this.entityManager.update(
            VideoDelegationEntity,
            { id: delegationId },
            { approvalWorkItemId, card, updatedAt: () => "now()" },
        )
    }

    private async settle(delegationId: string, status: string, error: OptionalFailureReason): Promise<boolean> {
        const result = await this.entityManager.update(
            VideoDelegationEntity,
            { id: delegationId, status: "rendering" },
            { status, error, updatedAt: () => "now()" },
        )
        return (result.affected ?? 0) > 0
    }
}
