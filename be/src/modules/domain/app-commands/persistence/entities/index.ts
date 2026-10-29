import { AppCommandEntity } from "./app-command.entity"

export { AppCommandEntity }

/** Every entity the app-commands capability owns, collected by the database connection. */
export const appCommandsEntities = [AppCommandEntity] as const
