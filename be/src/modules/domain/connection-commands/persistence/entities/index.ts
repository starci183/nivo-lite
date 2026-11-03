import { ConnectionCommandEntity } from "./connection-command.entity"

export { ConnectionCommandEntity }

/** The entities the connection commands capability owns, for the app's connection. */
export const connectionCommandsEntities: readonly [typeof ConnectionCommandEntity] = [ConnectionCommandEntity] as const
