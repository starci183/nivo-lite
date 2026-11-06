import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { AgentTagService } from "@modules/domain/agent-work"
import { PaymentTransactionsService } from "@modules/domain/payment-transactions"
import type { OptionalRecordedMovement, PaymentMovement, RecordedMovement } from "@modules/domain/payment-transactions"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectBankFeedFlow } from "./billing.decorators"
import type { BankFeedFlow } from "./billing.decorators"
import type { FeedCreditAnswer, ProvenConnection } from "./billing.contracts"

/** The locale of the lines billing writes into the shared records: the workspace owners read them in Vietnamese. */
const RECORD_LOCALE = "vi"

/** What a tag of the bound agent says started it: the bank feed. */
const BANK_FEED_TAG_SOURCE = "bank_feed"

/** The movement of a credit or debit the bank feed handed over, as the `payment.transaction` record keeps it. */
const movementOf = (credit: IncomingCredit, direction: PaymentMovement["direction"]): PaymentMovement => ({
    direction,
    amountVnd: Math.round(credit.amount),
    reference: credit.content === "" ? null : credit.content,
    payer: credit.payer ?? null,
    externalRef: credit.eventId,
    account: credit.account ?? null,
    occurredAt: credit.occurredAt ?? null,
})

@Injectable()
/**
 * What the bank feed hands to the bound accounting agent besides the booking path: a new credit of an agent whose live version has a
 * flow is recorded as a transaction and tags the agent, and money that left the account is recorded as a debit. Both write inside the
 * transaction of the receipt, so the receipt is completed only when they are.
 */
export class BankFeedFlowService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly transactions: PaymentTransactionsService,
        private readonly tags: AgentTagService,
        @Optional() @InjectBankFeedFlow() private readonly flow: BankFeedFlow | null = null,
    ) {}

    /** Whether the bound agent's live version has a flow: then the flow alone owns the credit, and the booking path holds nothing. */
    async owns(workspaceId: string, agentId: string): Promise<boolean> {
        return this.flow !== null && (await this.flow.hasLiveFlow(workspaceId, agentId))
    }

    /**
     * Records a credit of the bank feed as a `payment.transaction` record, once per provider transaction, inside the transaction of the
     * receipt; null when the engine refused it. A repeat of the same transaction answers the same record with `created` false.
     */
    record(tx: EntityManager, connection: ProvenConnection, credit: IncomingCredit): Promise<OptionalRecordedMovement> {
        return this.transactions.record(tx, connection.workspaceId, movementOf(credit, "credit"))
    }

    /**
     * A new credit of an agent whose live version has a flow reaches that agent: the agent is tagged with the recorded transaction, once
     * per transaction (the wake is keyed by the connection and the provider transaction id). Exactly one path takes a credit: the flow's,
     * or with no flow the booking path alone.
     */
    async tag(
        tx: EntityManager,
        connection: ProvenConnection,
        agentId: string,
        credit: IncomingCredit,
        recorded: RecordedMovement,
    ): Promise<void> {
        const amountVnd = Math.round(credit.amount)
        await this.tags.tagAgent(
            {
                source: BANK_FEED_TAG_SOURCE,
                workspaceId: connection.workspaceId,
                toAgentId: agentId,
                text: this.catalog.get(
                    "billing.bankFeedTag",
                    { amount: amountVnd, content: credit.content },
                    RECORD_LOCALE,
                ),
                subject: `bank-transaction:${recorded.id}`,
                eventKey: `bank-feed:${connection.connectionId}:${credit.eventId}`,
            },
            tx,
        )
    }

    /**
     * Records money that left the account as a debit transaction: never an inbound payment event and never a reconcile job, so a
     * supplier payment is not matched against the workspace's invoices. The receipt claim already made it once per delivery.
     */
    async debit(tx: EntityManager, connection: ProvenConnection, credit: IncomingCredit): Promise<FeedCreditAnswer> {
        await this.transactions.record(tx, connection.workspaceId, movementOf(credit, "debit"))
        return { status: "debited" }
    }
}
