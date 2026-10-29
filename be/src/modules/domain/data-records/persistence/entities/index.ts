import { DataRecordEntity } from "./data-record.entity"

export { DataRecordEntity }

/** The entities the data records capability owns, for the app's connection. */
export const dataRecordsEntities = [DataRecordEntity] as const
