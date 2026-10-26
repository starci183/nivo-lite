import { parseJson } from "./realtime-json.mapper"
import { RealtimeNotificationSchema } from "./realtime-notification.schema"
import type { RealtimeNotification } from "./realtime-notification.schema"

/** Reads the payload of a NOTIFY on the hub channel: a notification of the shape the hub publishes, or undefined for anything else. */
export const readNotification = (payload: string): RealtimeNotification | undefined => {
    const answer = RealtimeNotificationSchema.safeParse(parseJson(payload).value)
    return answer.success ? answer.data : undefined
}
