import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChainRepeatQuery, OptionalChainDepth, OptionalChainSpot } from "./work-items-chain-read.contracts"
import { WorkItemEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of where work items sit in their command chains, for the planner of other capabilities; `manager` joins the caller's transaction. */
export class WorkItemsChainReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Where the item sits in its chain; null when the workspace has no such item. */
    async spotOf(
        workspaceId: string,
        itemId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalChainSpot> {
        const row = await manager.findOne(WorkItemEntity, {
            select: { id: true, chainId: true, depth: true },
            where: { workspaceId, id: itemId },
        })
        return row === null ? null : { id: row.id, chainId: row.chainId, depth: row.depth }
    }

    /** The depth of the deepest item of the chain; null when the chain has no item. */
    async topDepth(
        workspaceId: string,
        chainId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalChainDepth> {
        const row = await manager.findOne(WorkItemEntity, {
            select: { depth: true },
            where: { workspaceId, chainId },
            order: { depth: "DESC" },
        })
        return row === null ? null : row.depth
    }

    /** Whether the chain already holds another item with the same action about the same subject. */
    repeats(query: ChainRepeatQuery, manager: EntityManager = this.entityManager): Promise<boolean> {
        const where: FindOptionsWhere<WorkItemEntity> = {
            workspaceId: query.workspaceId,
            chainId: query.chainId,
            action: query.action,
            subjectType: query.subjectType,
            dedupeKey: Not(query.dedupeKey),
            subjectId: query.subjectId ?? IsNull(),
        }
        return manager.exists(WorkItemEntity, { where })
    }
}
