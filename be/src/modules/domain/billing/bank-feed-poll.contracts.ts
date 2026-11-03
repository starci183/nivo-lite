import type { IncomingCredit } from "@modules/domain/bank-feed-inbox"

/** One bank transaction a poller found, ready for the same inbox path a webhook delivery takes. */
export interface PolledCredit {
    /** The connection-scoped delivery key: the same key the provider's webhook uses, so a webhook row and a polled row are one row. */
    readonly deliveryId: string
    /** The credit or debit to book. */
    readonly credit: IncomingCredit
}
