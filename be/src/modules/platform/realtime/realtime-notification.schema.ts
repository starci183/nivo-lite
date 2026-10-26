import { z } from "zod"

/** The notification the hub publishes after it wrote a row: the topic and the sequence number of the `realtime_events` row, bounded as the hub bounds them. */
export const RealtimeNotificationSchema = z.object({
    topic: z.string().max(256),
    seq: z.number().int().nonnegative(),
})

/** The notification of one written row. */
export type RealtimeNotification = z.infer<typeof RealtimeNotificationSchema>
