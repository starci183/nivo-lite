import { Injectable } from "@nestjs/common"
import { PollScheduleService } from "@modules/domain/connection-poll"
import type { ZaloRawDelivery } from "./zalo-inbox.contracts"
import { ZaloInboxService } from "./zalo-inbox.service"

@Injectable()
/**
 * The intake of one verified Zalo delivery: the receipt is recorded once, and only then does the connection's poll schedule learn that its
 * webhook is healthy, so a delivery that was refused leaves the schedule untouched.
 */
export class ZaloDeliveryIntakeService {
    constructor(
        private readonly inbox: ZaloInboxService,
        private readonly schedule: PollScheduleService,
    ) {}

    /** Records one verified delivery for deferred processing, then marks the connection's webhook as having delivered. */
    async accept(rawBody: ZaloRawDelivery, connection: string): Promise<void> {
        await this.inbox.acceptZaloDelivery(rawBody, connection)
        await this.schedule.recordWebhook(connection)
    }
}
