import { Injectable } from "@nestjs/common"
import { ChannelsError, ChannelsErrorCode } from "@modules/domain/channels"
import type { ChannelTarget, CustomerSendPort, CustomerSendRequest, DeliveryResult, PersonMessage } from "@modules/domain/channels"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { TELEGRAM_SEND_OPERATION, TELEGRAM_STAFF_OPERATION, TELEGRAM_TYPING_OPERATION } from "./telegram-sandbox-send.catalogue"

/** Delivered as the live bot route answers it. */
const DELIVERED: DeliveryResult = { delivered: true, failure: null, outcome: "acknowledged" }

/** The live receipt of Telegram's explicit refusal (`TELEGRAM_REJECTED`, a blocked bot) and of a person with no chat id: a definite refusal. */
const NOT_DELIVERED: DeliveryResult = { delivered: false, failure: null, outcome: "rejected" }

/** The live receipt of a call Telegram never answered: the outcome is unknown. */
const UNKNOWN: DeliveryResult = { delivered: false, failure: null, outcome: "ambiguous" }

@Injectable()
/**
 * The sandbox twin of the Telegram customer send (`TELEGRAM-SEND-1` .. `3`): it records the send and never reaches Telegram. The account's
 * next case answers: delivered (default), the typed refusal of a blocked bot, or an unknown outcome; a person with no chat id is refused as
 * live. Telegram has no reply window. It is also the sandbox of the staff text (`TELEGRAM-STAFF-1` accepted by default, `TELEGRAM-STAFF-2`
 * throws what the live route throws when the bot is gone) and of "typing" (always shown, logged). One logged call per request.
 */
export class TelegramSandboxSendService implements CustomerSendPort {
    readonly provider = "telegram"

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Answers one send of a sandbox account from its next case; one logged call per send. */
    send(
        account: ConnectionRecord,
        _target: ChannelTarget,
        userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult> {
        return this.sandbox.call(
            account,
            TELEGRAM_SEND_OPERATION,
            { userId, text: request.text, images: request.images ?? [] },
            {
                key: userId ?? "",
                answer: (state) => {
                    if (userId === null || state.nextCase === "TELEGRAM-SEND-2") return NOT_DELIVERED
                    if (state.nextCase === "TELEGRAM-SEND-3") return UNKNOWN
                    return DELIVERED
                },
            },
        )
    }

    /** Answers one staff text of a sandbox account: accepted by default, or the live refusal of a bot that is gone; one logged call per text. */
    sendToPerson(account: ConnectionRecord, request: PersonMessage): Promise<void> {
        return this.sandbox.call(
            account,
            TELEGRAM_STAFF_OPERATION,
            { recipientId: request.recipientId, text: request.text },
            {
                key: request.recipientId,
                answer: (state) => {
                    if (state.nextCase === "TELEGRAM-STAFF-2") throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
                    return Promise.resolve()
                },
            },
        )
    }

    /** Shows "typing" in the chat of the person: recorded, never sent anywhere. */
    showTyping(account: ConnectionRecord, personId: string): Promise<void> {
        return this.sandbox.call(account, TELEGRAM_TYPING_OPERATION, { personId }, { key: personId, answer: () => Promise.resolve() })
    }
}
