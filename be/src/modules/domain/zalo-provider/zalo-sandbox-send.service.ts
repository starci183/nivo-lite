import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ChannelsError, ChannelsErrorCode, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import type { ChannelTarget, CustomerSendPort, CustomerSendRequest, DeliveryResult, PersonMessage } from "@modules/domain/channels"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { ZALO_PROFILE_NONE_CASE, ZALO_PROFILE_OPERATION, zaloLastLineAt, zaloSandboxProfileOf } from "./zalo-sandbox.catalogue"
import { ZALO_SEND_OPERATION, ZALO_STAFF_OPERATION } from "./zalo-sandbox-send.catalogue"

/** Delivered as the live consultation route answers it. */
const DELIVERED: DeliveryResult = { delivered: true, failure: null, outcome: "acknowledged", via: "consultation" }

/** The live window refusal (the owner's `outside_window`): Zalo's `zalo_window_expired`, a definite refusal. */
const OUTSIDE_WINDOW: DeliveryResult = { delivered: false, failure: "zalo_window_expired", outcome: "rejected" }

/** The live receipt of a person the send has no Zalo id for. */
const NOT_CONNECTED: DeliveryResult = { delivered: false, failure: "zalo_not_connected", outcome: "rejected" }

/** The live receipt of an access token Zalo rejects again after a refresh. */
const TOKEN_REFUSED: DeliveryResult = { delivered: false, failure: "zalo_token", outcome: "rejected" }

/** The live receipt of a call Zalo never answered: no numeric Zalo error, so the outcome is unknown. */
const TIMED_OUT: DeliveryResult = { delivered: false, failure: "zalo_error", outcome: "ambiguous" }

@Injectable()
/**
 * The sandbox twin of the Zalo customer send (`ZALO-SEND-1` .. `4`): it records the send and never reaches Zalo. A person whose last line
 * (sandbox state `last-line`, kept by the inbound cases) is older than 48 hours before the request's moment is refused with the live
 * window receipt, whatever case the account picked; a person who never wrote is open, as live. Otherwise the account's next case
 * answers: delivered (default), the window refusal, a rejected token or an unknown outcome. There is no ZNS fallback in the sandbox: a
 * refused send that carries a renewal notice says `zns_not_configured`, as a live OA without a template does.
 *
 * It is also the sandbox of the other channel calls of a Zalo account: the customer's name (the profile cases `ZALO-4` / `ZALO-5`, the same
 * answer as the profile read, one logged `profileOf` call) and the staff text (`ZALO-STAFF-1` accepted by default; `ZALO-STAFF-2` throws
 * what the live route throws without a usable token), one logged `sendToPerson` call per text. Zalo has no typing.
 */
export class ZaloSandboxSendService implements CustomerSendPort {
    readonly provider = "zalo_oa"

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
            ZALO_SEND_OPERATION,
            { userId, text: request.text, images: request.images ?? [] },
            {
                key: userId ?? "",
                answer: async (state) => {
                    if (userId === null) return NOT_CONNECTED
                    const last = await zaloLastLineAt(state, userId)
                    const closed = last !== null && request.at.getTime() - last > ZALO_FREE_WINDOW_MS
                    if (closed || state.nextCase === "ZALO-SEND-2") return this.refused(request)
                    if (state.nextCase === "ZALO-SEND-3") return TOKEN_REFUSED
                    if (state.nextCase === "ZALO-SEND-4") return TIMED_OUT
                    return DELIVERED
                },
            },
        )
    }

    /** The window refusal, with the note the live route adds when a renewal notice finds no ZNS template. */
    private refused(request: CustomerSendRequest): DeliveryResult {
        return request.notification === undefined ? OUTSIDE_WINDOW : { ...OUTSIDE_WINDOW, note: "zns_not_configured" }
    }

    /** Answers one staff text of a sandbox account: accepted by default, or the live refusal of a missing token; one logged call per text. */
    sendToPerson(account: ConnectionRecord, request: PersonMessage): Promise<void> {
        return this.sandbox.call(account, ZALO_STAFF_OPERATION, { recipientId: request.recipientId, text: request.text }, {
            key: request.recipientId,
            answer: (state) => {
                if (state.nextCase === "ZALO-STAFF-2") throw new ChannelsError({ code: ChannelsErrorCode.ZaloNotAuthorized })
                return Promise.resolve()
            },
        })
    }

    /** The customer's name as the catalogue's profile answers it (an empty text for a person the OA does not know); one logged `profileOf` call. */
    async nameOf(account: ConnectionRecord, personId: string): Promise<string> {
        const profile = await this.sandbox.call(account, ZALO_PROFILE_OPERATION, { personId }, {
            key: personId,
            answer: (state) => (state.nextCase === ZALO_PROFILE_NONE_CASE ? null : zaloSandboxProfileOf(personId)),
        })
        return profile?.name ?? ""
    }
}
