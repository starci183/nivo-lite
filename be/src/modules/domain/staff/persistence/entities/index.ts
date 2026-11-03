import { StaffEntity } from "./staff.entity"

export { StaffEntity } from "./staff.entity"

/** Every entity of the staff capability. */
export const staffEntities: readonly [typeof StaffEntity] = [StaffEntity] as const
