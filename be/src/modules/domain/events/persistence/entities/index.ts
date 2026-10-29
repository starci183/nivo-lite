import { EventEntity } from "./event.entity"

export { EventEntity }

/** The entities the events capability owns, collected by the database module. */
export const eventsEntities = [EventEntity] as const
