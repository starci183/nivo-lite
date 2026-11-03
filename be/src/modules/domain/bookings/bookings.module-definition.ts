import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingsOptions } from "./bookings.options"

/** The configurable-module base of the booking capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<BookingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
