import { BookingSettingEntity } from "./booking-setting.entity"

export { BookingSettingEntity }

/** Every entity the booking-settings capability owns, collected by the database connection. */
export const bookingSettingsEntities = [BookingSettingEntity] as const
