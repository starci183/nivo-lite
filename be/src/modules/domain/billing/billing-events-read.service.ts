import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BillingEventEntity } from "./persistence/entities"

/** A billing event as the console lists it. */
export interface BillingEventRow {
    /** The event id. */
    readonly id: string
    /** The workspace, when known. */
    readonly workspaceId: string | null
    /** What happened. */
    readonly kind: string
    /** When it happened. */
    readonly createdAt: Date
}

const toRow = (row: BillingEventEntity): BillingEventRow => ({
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    createdAt: row.createdAt,
})

@Injectable()
/** Billing event reads for the platform team console. */
export class BillingEventsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest events of one workspace, newest first. */
    async latestOfWorkspace(workspaceId: string, limit: number): Promise<Array<BillingEventRow>> {
        const rows = await this.entityManager.find(BillingEventEntity, {
            select: { id: true, workspaceId: true, kind: true, createdAt: true },
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** The newest events of every workspace, newest first. */
    async latest(limit: number): Promise<Array<BillingEventRow>> {
        const rows = await this.entityManager.find(BillingEventEntity, {
            select: { id: true, workspaceId: true, kind: true, createdAt: true },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }
}
