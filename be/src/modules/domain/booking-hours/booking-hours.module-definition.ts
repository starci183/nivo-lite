import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingHoursOptions } from "./booking-hours.options"

/** Configurable-module base for the weekly booking hours capability. */
const definition = new ConfigurableModuleBuilder<BookingHoursOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingHoursOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingHoursOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
