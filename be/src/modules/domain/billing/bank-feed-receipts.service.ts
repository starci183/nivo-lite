import { BankFeedReceiptService, type FeedReceiptPayload, type IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import { BANK_FEED_DELIVERY_QUEUE, type BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { FeedWebhookRegistryService, type FeedWebhookPort } from "@modules/domain/provider-registry"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { createHash } from "node:crypto"
import type { RawBody, HeaderValue, BankFeedProvider } from "./billing.contracts"
import { bankFactsOfCredit } from "./bank-facts.policy"
import { cassoCredits, isCassoError } from "./casso.policy"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"
import { payosBodyOf, readPayosDelivery } from "./payos.policy"
import { parseJsonObject } from "./webhook-body.policy"

@Injectable()
/**
 * The receipt intake of the bank feed: a webhook door proves each delivery, and this service records it once, with its queue message in
 * the same transaction. It decides nothing about a movement; when the job runs, `BankFeedService` keeps the delivery as raw account rows and
 * hands them to the account's trigger.
 */
export class BankFeedReceiptsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly proof: PaymentProofService,
        private readonly bankFeedInbox: BankFeedReceiptService,
        private readonly webhooks: FeedWebhookRegistryService,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** Records Casso's verified raw delivery for processing after the receipt commits. */
    acceptCassoDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const raw = rawBody ?? Buffer.alloc(0)
        const body = parseJsonObject(raw)
        const credits = isCassoError(body)
            ? []
            : cassoCredits(body).map((credit) => ({
                  amount: credit.amount,
                  content: credit.content,
                  eventId: credit.eventId,
                  fallbackBankName: credit.bankName,
                  ...bankFactsOfCredit(credit),
              }))
        const deliveryId = `${connection}:${createHash("sha256").update(raw).digest("hex")}`
        return this.recordFeedDelivery("casso", deliveryId, connection, credits)
    }

    /** Records a verified paid payOS delivery; confirmation pings and unpaid deliveries remain acknowledgements only. */
    acceptPayosDelivery(rawBody: RawBody, connection: string): Promise<void> {
        const reading = readPayosDelivery(payosBodyOf(parseJsonObject(rawBody)))
        if (reading.kind === "ignored") return Promise.resolve()
        return this.recordFeedDelivery("payos", `${connection}:${reading.eventId}`, connection, [
            {
                amount: reading.amount,
                content: reading.content,
                eventId: reading.eventId,
                fallbackBankName: "payOS",
                ...bankFactsOfCredit(reading),
            },
        ])
    }

    /**
     * Proves the workspace feed credential of a provider before its HTTP door admits the raw delivery to receipt intake. A refused key
     * is remembered by the provider for the connection page; any other failure is not the sender's doing.
     */
    async verifyFeedDelivery(
        authorization: HeaderValue,
        connection: string,
        rawBody: RawBody,
        provider: string,
    ): Promise<void> {
        try {
            await this.proof.proveFeed(provider, { authorization, connectionId: connection, rawBody })
        } catch (error) {
            if (error instanceof BillingError && error.code === BillingErrorCode.WebhookUnauthorized) {
                await this.webhooks.of(provider)?.traceRefusal(connection)
            }
            throw error
        }
    }

    /**
     * Records one verified feed transaction of a provider as a receipt: money in as a credit, money out as a debit; anything its
     * provider reads as no money move (a test ping, a zero amount) is acknowledged without a receipt, and a delivery it cannot read is invalid.
     */
    acceptFeedDelivery(rawBody: RawBody, connection: string, provider: string): Promise<void> {
        const port = this.webhooks.of(provider)
        if (port === undefined) return Promise.reject(new BillingError({ code: BillingErrorCode.WebhookInvalid }))
        return port.traceIntake(connection, rawBody, () => this.bookFeedDelivery(port, rawBody, connection))
    }

    /**
     * Records one transaction a reconcile run read back from its provider, through the receipt path a webhook delivery takes, under the
     * delivery key the webhook uses: a transaction the webhook already delivered is not recorded again. Answers true when this call
     * recorded it, that is when the webhook never did.
     */
    acceptPolledCredit(
        connection: string,
        provider: BankFeedProvider,
        deliveryId: string,
        credit: IncomingCredit,
    ): Promise<boolean> {
        return this.claimFeedDelivery(provider, deliveryId, { connection, credits: [credit], source: "poll" })
    }

    private async bookFeedDelivery(port: FeedWebhookPort, rawBody: RawBody, connection: string): Promise<void> {
        const reading = port.read(parseJsonObject(rawBody))
        if (reading.kind === "invalid") throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
        if (reading.kind === "ignored") return
        await this.recordFeedDelivery(port.inboxProvider, `${connection}:${reading.credit.eventId}`, connection, [
            reading.credit,
        ])
    }

    private async recordFeedDelivery(
        provider: BankFeedProvider,
        deliveryId: string,
        connection: string,
        credits: ReadonlyArray<IncomingCredit>,
    ): Promise<void> {
        await this.claimFeedDelivery(provider, deliveryId, { connection, credits })
    }

    /** Claims the receipt once and hands it to the delivery job in the same transaction; answers false for a repeat or an empty delivery. */
    private claimFeedDelivery(
        provider: BankFeedProvider,
        deliveryId: string,
        payload: FeedReceiptPayload,
    ): Promise<boolean> {
        if (payload.credits.length === 0) return Promise.resolve(false)
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.bankFeedInbox.claim(manager, provider, deliveryId, payload))) return false
            const message: BankFeedDeliveryRecorded = { provider, deliveryId }
            await this.outbox.write(manager, BANK_FEED_DELIVERY_QUEUE, message, {
                dedupeKey: `${BANK_FEED_DELIVERY_QUEUE}:${provider}:${deliveryId}`,
            })
            return true
        })
    }
}
