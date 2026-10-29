import { AiUsageEventEntity } from "./ai-usage-event.entity"

export { AiUsageEventEntity }

/** Every entity the ai-usage-events capability owns, collected by the database connection. */
export const aiUsageEventsEntities = [AiUsageEventEntity] as const
