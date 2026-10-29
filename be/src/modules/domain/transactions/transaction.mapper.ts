import type { TransactionEntity } from "./persistence/entities"
import type { TransactionRow } from "./transactions.contracts"

/** The columns a transaction contract reads. */
export type TransactionFacts = Pick<
    TransactionEntity,
    "id" | "workspaceId" | "inboundEventId" | "amountVnd" | "reference" | "payer" | "invoiceId" | "status"
>

/** Maps a stored payment to the contract row. */
export const toTransactionRow = (entity: TransactionFacts): TransactionRow => ({
    id: entity.id,
    workspace_id: entity.workspaceId,
    inbound_event_id: entity.inboundEventId,
    amount_vnd: entity.amountVnd,
    reference: entity.reference,
    payer: entity.payer,
    invoice_id: entity.invoiceId,
    status: entity.status,
})
