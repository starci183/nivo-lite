import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { NewVideoDelegation, OptionalDelegationId, OptionalDelegationRender } from "./video-delegations.contracts"
import type { DelegationIdRow, DelegationRenderRow } from "./persistence/video-delegations.rows"
import {
    FIND_DELEGATION_OF_ITEM,
    FIND_DELEGATION_OF_RENDER,
    INSERT_DELEGATION,
    SAVE_DELEGATION_CARD,
    SETTLE_DELEGATION,
    SET_DELEGATION_RENDER,
} from "./persistence/video-delegations.sql"

@Injectable()
/** The owner of video_delegations: the scripts other agents delegated to AI Editor and how each one came back. */
export class VideoDelegationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The delegation a work item already made, or null. */
    async ofWorkItem(workspaceId: string, workItemId: string): Promise<OptionalDelegationId> {
        const [row] = await this.entityManager.query<Array<DelegationIdRow>>(FIND_DELEGATION_OF_ITEM, [
            workspaceId,
            workItemId,
        ])
        return row ?? null
    }

    /** Records a delegation in the caller's transaction; null when nothing was written. */
    async record(tx: EntityManager, input: NewVideoDelegation): Promise<OptionalDelegationId> {
        const [row] = await tx.query<Array<DelegationIdRow>>(INSERT_DELEGATION, [
            input.workspaceId,
            input.workItemId,
            input.projectId,
            input.sourceModule,
            input.contentItemId,
            input.channels,
        ])
        return row ?? null
    }

    /** Links the render queued for a delegation. */
    async linkRender(delegationId: string, renderId: string): Promise<void> {
        await this.entityManager.query(SET_DELEGATION_RENDER, [delegationId, renderId])
    }

    /** The still rendering delegation of a settled render, with what its cards show; null when nobody delegated it. */
    async ofSettledRender(renderId: string): Promise<OptionalDelegationRender> {
        const [row] = await this.entityManager.query<Array<DelegationRenderRow>>(FIND_DELEGATION_OF_RENDER, [renderId])
        return row ?? null
    }

    /** Settles a rendering delegation as ready (its cards go out); true only for the one call that settled it. */
    markReady(delegationId: string): Promise<boolean> {
        return this.settle(delegationId, "ready", null)
    }

    /** Settles a rendering delegation as failed with the reason; true only for the one call that settled it. */
    markFailed(delegationId: string, error: string | null): Promise<boolean> {
        return this.settle(delegationId, "failed", error)
    }

    /** Keeps the card AI Editor posted and the work item that decides it. */
    async saveCard(delegationId: string, approvalWorkItemId: string, card: object): Promise<void> {
        await this.entityManager.query(SAVE_DELEGATION_CARD, [delegationId, approvalWorkItemId, JSON.stringify(card)])
    }

    private async settle(delegationId: string, status: string, error: string | null): Promise<boolean> {
        const rows = await this.entityManager.query<Array<DelegationIdRow>>(SETTLE_DELEGATION, [
            delegationId,
            status,
            error,
        ])
        return rows.length > 0
    }
}
