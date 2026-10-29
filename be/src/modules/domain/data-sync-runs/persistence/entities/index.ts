import { DataSyncRunEntity } from "./data-sync-run.entity"

export { DataSyncRunEntity }

/** The entities the data sync runs capability owns, for the app's connection. */
export const dataSyncRunsEntities = [DataSyncRunEntity] as const
