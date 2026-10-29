import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { EmailMessageEntity } from "./persistence/entities"

@Injectable()
/** The mail history questions of report readers, always bounded by the caller. */
export class EmailMessagesLedgerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The invoice ids (null when a mail names none) a debt reminder was sent or is waiting for since the instant. */
    async remindedInvoiceIds(workspaceId: string, since: Date, limit: number): Promise<Array<string | null>> {
        const rows = await this.entityManager
            .createQueryBuilder(EmailMessageEntity, "e")
            .select("e.refs ->> 'invoice_id'", "invoiceId")
            .distinct(true)
            .where(
                "e.workspaceId = :workspaceId AND e.purpose = 'debt_reminder' AND e.status IN ('sent', 'waiting_decision') AND e.createdAt >= :since",
                { workspaceId, since },
            )
            .limit(limit)
            .getRawMany<{ invoiceId: string | null }>()
        return rows.map((row) => row.invoiceId)
    }
}
