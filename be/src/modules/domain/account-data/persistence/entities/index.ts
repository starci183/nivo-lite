import { AccountDataEntity } from "./account-data.entity"

export { AccountDataEntity }

/** The entities the account-data capability owns, collected by the database module. */
export const accountDataEntities: readonly [typeof AccountDataEntity] = [AccountDataEntity] as const
