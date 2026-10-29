import { InboundEventEntity } from "./inbound-event.entity"

export { InboundEventEntity }

/** The entities the inbound-events capability owns, collected by the database module. */
export const inboundEventsEntities = [InboundEventEntity] as const
