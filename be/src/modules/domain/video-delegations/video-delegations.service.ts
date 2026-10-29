import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    NewVideoDelegation,
    OptionalDelegationId,
    OptionalDelegationRender,
    OptionalFailureReason,
} from "./video-delegations.contracts"
import type { DelegationRenderRow } from "./persistence/video-delegations.rows"
import { VideoProjectEntity } from "@modules/domain/video-projects"
import { VideoRenderEntity } from "@modules/domain/video-renders"
import { VideoDelegationEntity } from "./persistence/entities"

@Injectable()
/** The owner of video_delegations: the scripts other agents delegated to AI Editor and how each one came back. */
export class VideoDelegationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

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
        const id = (result.identifiers[0] as { readonly id?: string } | undefined)?.id
        return id === undefined ? null : { id, project_id: input.projectId }
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
        const row = await this.entityManager
            .createQueryBuilder(VideoDelegationEntity, "d")
            .select([
                "d.id AS id",
                "d.workspace_id AS workspace_id",
                "d.work_item_id AS work_item_id",
                "d.project_id AS project_id",
                "d.source_module AS source_module",
                "d.channels AS channels",
                "p.title AS title",
                "p.aspect AS aspect",
                "p.script AS script",
                "r.id AS render_id",
                "r.status AS render_status",
                "r.duration_ms AS duration_ms",
                "r.output_path AS output_path",
                "r.poster_path AS poster_path",
                "r.meta ->> 'captions_path' AS captions_path",
                "r.meta ->> 'captions_lang' AS captions_lang",
                "r.meta ->> 'voiceover' AS voiceover",
                "r.error AS error",
            ])
            .innerJoin(VideoProjectEntity, "p", "p.id = d.projectId AND p.workspaceId = d.workspaceId")
            .innerJoin(VideoRenderEntity, "r", "r.id = d.renderId AND r.workspaceId = d.workspaceId")
            .where("d.render_id = :renderId", { renderId })
            .andWhere("d.status = :rendering", { rendering: "rendering" })
            .andWhere("r.status IN (:...settled)", { settled: ["done", "failed"] })
            .limit(1)
            .getRawOne<DelegationRenderRow>()
        return row ?? null
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
