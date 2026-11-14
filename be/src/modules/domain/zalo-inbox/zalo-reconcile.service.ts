import { Injectable } from "@nestjs/common"
import { ZaloInboxPollService } from "./zalo-poll.service"

@Injectable()
/**
 * One reconcile run of the Zalo inbox: the messages the webhook never delivered are read back and kept as the webhook would have kept them.
 * The customer's name rides on what the OA's listing shows (the message trigger's subject); there is no profile round: a package node that
 * wants a picture or a name the event lacks reads the channel's profile through its tool.
 */
export class ZaloReconcileService {
    constructor(private readonly poll: ZaloInboxPollService) {}

    /** Runs the reconcile a queued job asks for (one connection when the payload names it, else every Zalo connection); a payload that is not a reconcile payload does nothing. */
    async run(payload: unknown): Promise<void> {
        await this.poll.reconcileFromJob(payload)
    }
}
