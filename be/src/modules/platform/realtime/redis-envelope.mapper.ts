import { parseJson } from "./realtime-json.mapper"
import type { Entry } from "./realtime-subscriptions.policy"
import { RedisEnvelopeSchema, RedisStreamFieldsSchema } from "./redis-envelope.schema"

/** One retained stream entry: the frame id a client resumes after, and the entry itself. */
export interface StreamEntry {
    /** The frame id the entry was written with: the `Last-Event-ID` a client names to resume after it. */
    readonly id: string
    /** The entry, as the hub hands it to a subscription. */
    readonly entry: Entry
}

/** The parsed JSON as an object, or undefined for a text that is not a JSON object. */
const objectOf = (text: string): object | undefined => {
    const { value } = parseJson(text)
    return typeof value === "object" && value !== null ? value : undefined
}

/** Reads a message of the hub channel: an entry of the shape the hub publishes, or undefined for anything else. */
export const readHubMessage = (message: string): Entry | undefined => {
    const envelope = RedisEnvelopeSchema.safeParse(objectOf(message))
    if (!envelope.success) return undefined
    const frame = objectOf(envelope.data.frame)
    return frame === undefined ? undefined : { topic: envelope.data.topic, position: envelope.data.position, frame }
}

/** The field/value pairs of a stream entry as a record. */
const fieldsOf = (pairs: ReadonlyArray<string>): Record<string, string | undefined> =>
    Object.fromEntries(pairs.flatMap((name, index) => (index % 2 === 0 ? [[name, pairs[index + 1]]] : [])))

/** Reads one entry of a topic's stream (`[stream id, [field, value, ...]]`): a retained frame, or undefined for an entry the hub did not write. */
export const readStreamEntry = (
    topic: string,
    raw: readonly [string, ReadonlyArray<string>],
): StreamEntry | undefined => {
    const [position, pairs] = raw
    const fields = RedisStreamFieldsSchema.safeParse(fieldsOf(pairs))
    if (!fields.success) return undefined
    const frame = objectOf(fields.data.data)
    return frame === undefined ? undefined : { id: fields.data.id, entry: { topic, position, frame } }
}
