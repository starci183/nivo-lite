import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingExceptionsOptions } from "./booking-exceptions.options"

/** Configurable-module base for the booking calendar exceptions capability. */
const definition = new ConfigurableModuleBuilder<BookingExceptionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingExceptionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingExceptionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
