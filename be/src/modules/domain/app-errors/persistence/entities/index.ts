import { AppErrorEntity } from "./app-error.entity"

export { AppErrorEntity }

/** Every entity the app-errors capability owns, collected by the database connection. */
export const appErrorsEntities: readonly [typeof AppErrorEntity] = [AppErrorEntity] as const
