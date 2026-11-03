import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingServicesOptions } from "./booking-services.options"

/** The configurable service catalogue capability; its importer decides whether it is global. */
const definition = new ConfigurableModuleBuilder<BookingServicesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingServicesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingServicesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
