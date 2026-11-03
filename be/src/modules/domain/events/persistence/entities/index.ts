import { EventEntity } from "./event.entity"

export { EventEntity }

/** The entities the events capability owns, collected by the database module. */
export const eventsEntities: readonly [typeof EventEntity] = [EventEntity] as const
