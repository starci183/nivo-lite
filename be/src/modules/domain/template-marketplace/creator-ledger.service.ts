import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CreatorLedgerView } from "./template-marketplace.contracts"
import { CreatorLedgerEntryEntity } from "./persistence/entities"

/** The most lines the ledger page lists. */
const LIST_MAX = 200

@Injectable()
/** The ledger of a creator, read only: what each sale owes them. The lines are written once by the payment and never change. */
export class CreatorLedgerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The ledger of the caller. */
    async mine(userId: string): Promise<CreatorLedgerView> {
        const rows = await this.entityManager.find(CreatorLedgerEntryEntity, {
            where: { creatorAccountId: userId },
            order: { createdAt: "DESC" },
            take: LIST_MAX,
        })
        return {
            lines: rows.map((row) => ({
                id: row.id,
                templateKey: row.templateKey,
                orderId: row.orderId,
                kind: row.kind,
                amountVnd: row.amountVnd,
                createdAt: row.createdAt.toISOString(),
            })),
            owedVnd: rows.filter((row) => row.kind === "creator_share").reduce((sum, row) => sum + row.amountVnd, 0),
        }
    }
}
