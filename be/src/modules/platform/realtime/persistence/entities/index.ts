import { RealtimeEventEntity } from "./realtime-event.entity"

export { RealtimeEventEntity } from "./realtime-event.entity"

/** Every entity of the realtime capability. */
export const realtimeEntities: readonly [typeof RealtimeEventEntity] = [RealtimeEventEntity] as const
