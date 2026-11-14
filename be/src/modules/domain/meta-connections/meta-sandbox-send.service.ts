import { Injectable } from "@nestjs/common"
import type { ChannelTarget, CustomerSendPort, CustomerSendRequest, DeliveryResult } from "@modules/domain/channels"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { META_REPLY_WINDOW_MS, metaLastLineAt } from "./meta-sandbox.catalogue"
import { META_SEND_OPERATION } from "./meta-sandbox-send.catalogue"

/** Delivered as the live Page sender answers its yes. */
const DELIVERED: DeliveryResult = { delivered: true, failure: null, outcome: "acknowledged" }

/** The live receipt of the Page sender's no (the Page is gone, Meta refused, the window is closed, Meta did not answer): the outcome is not known. */
const UNKNOWN: DeliveryResult = { delivered: false, failure: null, outcome: "ambiguous" }

@Injectable()
/**
 * The sandbox twin of the Meta customer send, Messenger and Instagram (`META-SEND-1` .. `3`): it records the send and never reaches
 * Meta. A person whose last line (sandbox state `last-line`, kept by the inbound cases) is more than 24 hours before the request's moment
 * is refused, whatever case the account picked; a person who never wrote is open. Otherwise the account's next case answers: delivered
 * (default), the window refusal, or an unknown outcome. The live sender answers only yes or no, so every refusal is the unknown-outcome
 * receipt, as live. One logged call per send.
 */
export class MetaSandboxSendService implements CustomerSendPort {
    readonly provider = "meta"

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Answers one send of a sandbox account from the window rule and the account's next case; one logged call per send. */
    send(
        account: ConnectionRecord,
        _target: ChannelTarget,
        userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult> {
        return this.sandbox.call(
            account,
            META_SEND_OPERATION,
            { userId, text: request.text, images: request.images ?? [] },
            {
                key: userId ?? "",
                answer: async (state) => {
                    if (userId === null) return UNKNOWN
                    const last = await metaLastLineAt(state, userId)
                    const closed = last !== null && request.at.getTime() - last > META_REPLY_WINDOW_MS
                    if (closed || state.nextCase === "META-SEND-2" || state.nextCase === "META-SEND-3") return UNKNOWN
                    return DELIVERED
                },
            },
        )
    }
}
