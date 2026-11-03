import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingWaitlistOptions } from "./booking-waitlist.options"

/** The configurable-module base of the booking waitlist; the importer decides whether it is global. */
const definition = new ConfigurableModuleBuilder<BookingWaitlistOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingWaitlistOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingWaitlistOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
