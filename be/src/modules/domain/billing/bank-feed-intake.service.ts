import { Injectable } from "@nestjs/common"
import { PollScheduleService } from "@modules/domain/connection-poll"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"
import type { RawBody } from "./billing.contracts"

@Injectable()
/**
 * The intake of one verified feed delivery: the receipt is recorded once, and only then does the connection's poll schedule learn that its
 * webhook is healthy, so a delivery that was refused leaves the schedule untouched.
 */
export class BankFeedIntakeService {
    constructor(
        private readonly feed: BankFeedReceiptsService,
        private readonly schedule: PollScheduleService,
    ) {}

    /** Records one verified delivery of a provider as a receipt (its rows and trigger follow when the job runs), then marks the connection's webhook as having delivered. */
    async acceptDelivery(rawBody: RawBody, connection: string, provider: string): Promise<void> {
        await this.feed.acceptFeedDelivery(rawBody, connection, provider)
        await this.schedule.recordWebhook(connection)
    }
}
