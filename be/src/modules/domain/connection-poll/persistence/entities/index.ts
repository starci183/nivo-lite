import { ConnectionPollScheduleEntity } from "./connection-poll-schedule.entity"

export { ConnectionPollScheduleEntity }

/** Every entity the connection-poll capability owns, collected by the database connection. */
export const connectionPollEntities: readonly [typeof ConnectionPollScheduleEntity] = [
    ConnectionPollScheduleEntity,
] as const
