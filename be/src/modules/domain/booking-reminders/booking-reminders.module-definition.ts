import { defineCapabilityModule } from "@starci/nest-kit"
import type { BookingRemindersOptions } from "./booking-reminders.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BookingRemindersOptions>()
