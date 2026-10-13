import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingRemindersOptions } from "./booking-reminders.options"

/** The configurable-module base of the booking reminders capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingRemindersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
