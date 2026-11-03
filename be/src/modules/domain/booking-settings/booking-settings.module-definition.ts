import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BookingSettingsOptions } from "./booking-settings.options"

/** The configurable-module base of booking settings; the importer decides whether it is global. */
const definition = new ConfigurableModuleBuilder<BookingSettingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BookingSettingsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BookingSettingsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
