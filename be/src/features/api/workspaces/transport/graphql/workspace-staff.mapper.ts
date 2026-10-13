import type { StaffOption } from "@modules/domain/workspace-members"
import type { StaffOptionType } from "./dto/staff-option.type"

/** Maps the linkable staff rows to the GraphQL type. */
export const toStaffOptionsType = (result: ReadonlyArray<StaffOption>): Array<StaffOptionType> =>
    result.map((staff) => ({ ...staff }))
