import { z } from "zod"

/** What the Redis hub publishes on its channel: the topic, the stream id of the retained entry (empty for a frame with no id) and the frame as JSON, bounded as the hub bounds them. */
export const RedisEnvelopeSchema = z.object({
    topic: z.string().max(256),
    position: z.string().max(64),
    frame: z.string().max(65_536),
})

/** The fields of one stream entry the hub wrote: the frame id and the frame as JSON. */
export const RedisStreamFieldsSchema = z.object({
    id: z.string().max(256),
    data: z.string().max(65_536),
})
