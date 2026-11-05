import { parseJsonText } from "@modules/platform/primitives"
import type { OptionalZaloEventName, ZaloRawBody } from "./zalo-event-name.contracts"

/** An event name Zalo sends is a short lower-case word with underscores or dots (`user_send_text`, `user_send_image`). */
const EVENT_NAME = /^[a-z0-9_.]{1,64}$/u

/**
 * The `event_name` of a Zalo webhook body, for a log line only: the body is not trusted (its mac may be wrong), so the name is returned
 * only when it has the shape of an event name, and null for anything else, including a body that is not JSON. Nothing else of the body is read.
 */
export const zaloEventNameOf = (rawBody: ZaloRawBody): OptionalZaloEventName => {
    if (rawBody === undefined) return null
    const read = parseJsonText(rawBody.toString())
    if (!read.ok) return null
    const parsed: unknown = read.value
    const name: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "event_name") : undefined
    return typeof name === "string" && EVENT_NAME.test(name) ? name : null
}
