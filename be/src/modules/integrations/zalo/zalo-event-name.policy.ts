/** An event name Zalo sends is a short lower-case word with underscores or dots (`user_send_text`, `user_send_image`). */
const EVENT_NAME = /^[a-z0-9_.]{1,64}$/u

/**
 * The `event_name` of a Zalo webhook body, for a log line only: the body is not trusted (its mac may be wrong), so the name is returned
 * only when it has the shape of an event name, and null for anything else, including a body that is not JSON. Nothing else of the body is read.
 */
export const zaloEventNameOf = (rawBody: Buffer | string | undefined): string | null => {
    if (rawBody === undefined) return null
    try {
        const parsed: unknown = JSON.parse(rawBody.toString())
        const name: unknown =
            typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "event_name") : undefined
        return typeof name === "string" && EVENT_NAME.test(name) ? name : null
    } catch {
        return null
    }
}
