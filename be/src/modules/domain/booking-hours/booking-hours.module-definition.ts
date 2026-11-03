import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingHoursOptions } from "./booking-hours.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingHoursOptions>()
