import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingRemindersOptions } from "./booking-reminders.options"

/** The configurable-module base of the booking reminders capability; `isGlobal` is decided by the importer. */
const definition = new ConfigurableModuleBuilder<BookingRemindersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingRemindersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingRemindersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
