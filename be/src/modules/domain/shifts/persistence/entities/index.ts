import { ShiftsPositionEntity } from "./shifts-position.entity"
import { ShiftsStaffEntity } from "./shifts-staff.entity"
import { ShiftsStaffPayEntity } from "./shifts-staff-pay.entity"
import { ShiftsCoverageEntity } from "./shifts-coverage.entity"
import { ShiftsSettingsEntity } from "./shifts-settings.entity"
import { ShiftsAvailabilityEntity } from "./shifts-availability.entity"
import { ShiftsLeaveRequestEntity } from "./shifts-leave-request.entity"
import { ShiftsSwapRequestEntity } from "./shifts-swap-request.entity"
import { ShiftsScheduleEntity } from "./shifts-schedule.entity"
import { ShiftsShiftEntity } from "./shifts-shift.entity"
import { ShiftsAttendanceEntity } from "./shifts-attendance.entity"
import { ShiftsNotificationEntity } from "./shifts-notification.entity"

export { ShiftsPositionEntity } from "./shifts-position.entity"
export { ShiftsStaffEntity } from "./shifts-staff.entity"
export { ShiftsStaffPayEntity } from "./shifts-staff-pay.entity"
export { ShiftsCoverageEntity } from "./shifts-coverage.entity"
export { ShiftsSettingsEntity } from "./shifts-settings.entity"
export { ShiftsAvailabilityEntity } from "./shifts-availability.entity"
export { ShiftsLeaveRequestEntity } from "./shifts-leave-request.entity"
export { ShiftsSwapRequestEntity } from "./shifts-swap-request.entity"
export { ShiftsScheduleEntity } from "./shifts-schedule.entity"
export { ShiftsShiftEntity } from "./shifts-shift.entity"
export { ShiftsAttendanceEntity } from "./shifts-attendance.entity"
export { ShiftsNotificationEntity } from "./shifts-notification.entity"

/** Every entity of the shifts capability. */
export const shiftsEntities = [
    ShiftsPositionEntity,
    ShiftsStaffEntity,
    ShiftsStaffPayEntity,
    ShiftsCoverageEntity,
    ShiftsSettingsEntity,
    ShiftsAvailabilityEntity,
    ShiftsLeaveRequestEntity,
    ShiftsSwapRequestEntity,
    ShiftsScheduleEntity,
    ShiftsShiftEntity,
    ShiftsAttendanceEntity,
    ShiftsNotificationEntity,
] as const
