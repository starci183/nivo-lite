import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { SepayTransactionEntity } from "./persistence/entities"

/** A bank transfer as the console lists it. */
export interface TransferAdminRow {
    /** The id the bank feed gave the transfer. */
    readonly sepayId: number
    /** The amount in VND, when the feed carried one. */
    readonly transferAmount: number | null
    /** The transfer content. */
    readonly content: string | null
    /** The processing status. */
    readonly status: string
    /** When the feed delivered it. */
    readonly receivedAt: Date
}

const COLUMNS = { sepayId: true, transferAmount: true, content: true, status: true, receivedAt: true } as const

const toRow = (row: SepayTransactionEntity): TransferAdminRow => ({
    sepayId: row.sepayId,
    transferAmount: row.transferAmount,
    content: row.content,
    status: row.status,
    receivedAt: row.receivedAt,
})

@Injectable()
/** Bank transfer reads for the platform team console. */
export class SepayTransactionsAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The transfers matched to the given orders, newest first, at most `limit`. */
    async matchedTo(orderIds: ReadonlyArray<string>, limit: number): Promise<Array<TransferAdminRow>> {
        if (orderIds.length === 0) return []
        const rows = await this.entityManager.find(SepayTransactionEntity, {
            select: COLUMNS,
            where: { matchedOrderId: In([...orderIds]) },
            order: { receivedAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** The newest transfers, newest first, at most `limit`. */
    async latest(limit: number): Promise<Array<TransferAdminRow>> {
        const rows = await this.entityManager.find(SepayTransactionEntity, {
            select: COLUMNS,
            order: { receivedAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }
}
