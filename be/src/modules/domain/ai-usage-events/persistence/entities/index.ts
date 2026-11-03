import { AiUsageEventEntity } from "./ai-usage-event.entity"
import { AiUsageNoticeEntity } from "./ai-usage-notice.entity"

export { AiUsageEventEntity, AiUsageNoticeEntity }

/** Every entity the ai-usage-events capability owns, collected by the database connection. */
export const aiUsageEventsEntities: readonly [typeof AiUsageEventEntity, typeof AiUsageNoticeEntity] = [
    AiUsageEventEntity,
    AiUsageNoticeEntity,
] as const
