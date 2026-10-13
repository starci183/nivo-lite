import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BookingSettingsOptions } from "./booking-settings.options"

/** The configurable-module base of booking settings; the importer decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BookingSettingsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
