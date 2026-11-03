import { createHash } from "node:crypto"
import { isRecord, parseJsonText } from "@modules/platform/primitives"

/** A JSON value narrowed to a plain object, or null. */
const objectOf = (value: unknown): Readonly<Record<string, unknown>> | null =>
    isRecord(value) ? Object.fromEntries(Object.entries(value)) : null

/** A string or number field of an object as text, or an empty text. */
const scalarOf = (source: Readonly<Record<string, unknown>> | null, key: string): string => {
    const value = source?.[key]
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

/** The events of a customer writing to the OA: each keeps the id of its message, so the same message from another door is the same delivery. */
const CUSTOMER_MESSAGE_EVENTS: ReadonlySet<string> = new Set(["user_send_text", "user_send_image", "user_send_file"])

const bodyOf = (rawBody: Buffer): Readonly<Record<string, unknown>> | null => {
    const read = parseJsonText(rawBody.toString("utf8"))
    return read.ok ? objectOf(read.value) : null
}

/**
 * The id a Zalo delivery is claimed under, always scoped by the connection. A customer text, picture or file keeps its message id. Any other event (follow,
 * unfollow, image, seen) takes its name, timestamp, sender and message id; a body without the name or the timestamp takes the hash of
 * its bytes, so two different events never share an id and a redelivery of the same bytes always does.
 */
export const zaloDeliveryIdOf = (connection: string, rawBody: Buffer): string => {
    const body = bodyOf(rawBody)
    const event = scalarOf(body, "event_name")
    const message = objectOf(body?.message)
    const messageId = scalarOf(message, "msg_id")
    if (CUSTOMER_MESSAGE_EVENTS.has(event) && messageId !== "") return `${connection}:${messageId}`
    const stamp = scalarOf(body, "timestamp")
    const who =
        scalarOf(objectOf(body?.sender), "id") ||
        scalarOf(objectOf(body?.follower), "id") ||
        scalarOf(objectOf(body?.user), "id")
    if (event === "" || stamp === "") {
        return `${connection}:raw:${createHash("sha256").update(rawBody).digest("hex")}`
    }
    return [connection, event, stamp, who, messageId].filter((part) => part !== "").join(":")
}
