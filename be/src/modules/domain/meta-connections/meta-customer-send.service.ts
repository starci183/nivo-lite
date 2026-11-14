import { Injectable } from "@nestjs/common"
import type { ChannelTarget, CustomerSendPort, CustomerSendRequest, DeliveryResult } from "@modules/domain/channels"
import type { ConnectionRecord } from "@modules/domain/connections"
import { MetaChannelSender } from "./meta-channel-sender.service"

/** The receipt of a message the Page sent. */
const DELIVERED: DeliveryResult = { delivered: true, failure: null, outcome: "acknowledged" }

/** The receipt of a message the Page did not send: the sender answers only yes or no, so the outcome is not known. */
const UNKNOWN: DeliveryResult = { delivered: false, failure: null, outcome: "ambiguous" }

@Injectable()
/**
 * The LIVE Meta customer send (Facebook Messenger and Instagram): the existing Page sender handed through the port unchanged. Its yes
 * is an acknowledged delivery, its no (the Page is gone, the credential unreadable, Meta refused, the 24-hour window closed) an unknown
 * outcome, as the engine always read it. The registry reaches it only for a live account.
 */
export class MetaCustomerSendService implements CustomerSendPort {
    readonly provider = "meta"

    constructor(private readonly sender: MetaChannelSender) {}

    /** Sends the text through the Page of the account the conversation came in on. */
    async send(
        _account: ConnectionRecord,
        target: ChannelTarget,
        _userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult> {
        return (await this.sender.send(target, request.text)) ? DELIVERED : UNKNOWN
    }
}
