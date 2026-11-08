import { isRecord, ok, refused, type Outcome } from "@modules/platform/primitives"
import type { InboundAttachment, ZaloInbound } from "./conversations.contracts"
import { ConversationsErrorCode } from "./errors/conversations.error"
import { epochMillisField, listField, readJsonObject, textField } from "./inbound-body.policy"

/** The event of a customer writing text to the OA. */
const TEXT_EVENT = "user_send_text"

/** The events of a customer sending a picture or a file; everything else (follow, seen) is acknowledged and ignored. */
const ATTACHMENT_EVENTS: ReadonlyMap<string, InboundAttachment["kind"]> = new Map([
    ["user_send_image", "image"],
    ["user_send_file", "file"],
])

/** What a reader of the event may trust: only a manual import names local files. */
export interface ZaloReadOptions {
    /** True for a row of a manual import, whose attachments may name a file of the import folder instead of an address. */
    readonly allowLocalPath?: boolean
}

/** The attachments of a message in the shape Zalo sends them: `{ type, payload: { url, thumbnail, name } }`; one with no address (and, for an import, no local path) is left out. */
const attachmentsOf = (
    message: unknown,
    kind: InboundAttachment["kind"],
    allowLocalPath: boolean,
): ReadonlyArray<InboundAttachment> => {
    return listField(message, "attachments").flatMap((item: unknown) => {
        const payload = isRecord(item) ? item.payload : undefined
        const url = textField(payload, "url")
        const localPath = allowLocalPath ? textField(item, "localPath") : ""
        if (url === "" && localPath === "") return []
        return [
            { kind, url, thumbnailUrl: textField(payload, "thumbnail"), name: textField(payload, "name"), localPath },
        ]
    })
}

/**
 * The customer message of one Zalo event: text, or a picture or file with its caption. A refusal for any other event and for one that lacks the
 * sender, the message id, the text (of a text event) or any attachment with an address (of a picture or file event).
 */
export const readZaloEvent = (
    raw?: Buffer,
    options: ZaloReadOptions = {},
): Outcome<ZaloInbound, ConversationsErrorCode> => {
    const body = readJsonObject(raw)
    if (body.kind !== "ok") return body
    const event = body.value
    const name = textField(event, "event_name")
    const userId = textField(event.sender, "id")
    const messageId = textField(event.message, "msg_id")
    const text = textField(event.message, "text").trim()
    const appId = textField(event, "app_id")
    const sentAt = epochMillisField(event, "timestamp")
    const kind = ATTACHMENT_EVENTS.get(name)
    if (userId === "" || messageId === "") return refused(ConversationsErrorCode.NotAnswered)
    if (name === TEXT_EVENT && text !== "") return ok({ appId, userId, messageId, text, attachments: [], sentAt })
    if (kind === undefined) return refused(ConversationsErrorCode.NotAnswered)
    const attachments = attachmentsOf(event.message, kind, options.allowLocalPath === true)
    return attachments.length === 0
        ? refused(ConversationsErrorCode.NotAnswered)
        : ok({ appId, userId, messageId, text, attachments, sentAt })
}
