import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingResourcesOptions } from "./booking-resources.options"

/** The configurable resource capability; its importer decides whether it is global. */
const definition = new ConfigurableModuleBuilder<BookingResourcesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingResourcesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingResourcesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
