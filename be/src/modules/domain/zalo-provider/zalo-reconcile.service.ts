import { Injectable } from "@nestjs/common"
import { ZaloInboxPollService } from "./zalo-poll.service"
import { ZaloProfileService } from "./zalo-profile.service"

@Injectable()
/** One reconcile run of the Zalo inbox: the messages the webhook never delivered are read back first, then the customers of the conversations get their name and picture. */
export class ZaloReconcileService {
    constructor(
        private readonly poll: ZaloInboxPollService,
        private readonly profiles: ZaloProfileService,
    ) {}

    /** Runs the reconcile a queued job asks for (one connection when the payload names it, else every Zalo connection); a payload that is not a reconcile payload does nothing. */
    async run(payload: unknown): Promise<void> {
        await this.poll.reconcileFromJob(payload)
        await this.profiles.refreshFromJob(payload)
    }
}
