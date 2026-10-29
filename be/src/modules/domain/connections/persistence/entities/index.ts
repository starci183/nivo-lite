import { ConnectionEntity } from "./connection.entity"

export { ConnectionEntity }

/** The entities the connections capability owns, for the app's connection. */
export const connectionsEntities = [ConnectionEntity] as const
