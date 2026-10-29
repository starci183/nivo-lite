import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TransactionEntity } from "./persistence/entities"
import type { CreditFigure } from "./transactions-figures.contracts"

/** The most open credits one governance read holds. */
const OPEN_CREDITS_MAX = 5000

@Injectable()
/** The dashboard lists of a workspace's transactions, always scoped to the workspace. */
export class TransactionsFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The credits that count for the governance figures: matched, unmatched or waiting for review. */
    async openCredits(workspaceId: string): Promise<Array<CreditFigure>> {
        const credits = await this.entityManager.find(TransactionEntity, {
            select: { id: true, invoiceId: true, payer: true, reference: true, amountVnd: true, status: true },
            where: { workspaceId, direction: "credit", status: In(["matched", "unmatched", "needs_review"]) },
            take: OPEN_CREDITS_MAX,
        })
        return credits.map((credit) => ({
            id: credit.id,
            invoiceId: credit.invoiceId,
            payer: credit.payer,
            reference: credit.reference,
            amountVnd: credit.amountVnd,
            status: credit.status,
        }))
    }
}
