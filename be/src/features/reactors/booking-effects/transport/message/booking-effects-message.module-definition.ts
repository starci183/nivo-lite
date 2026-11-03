import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { BookingEffectsMessageOptions } from "./booking-effects-message.options"

type Host = ConfigurableModuleHost<BookingEffectsMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<BookingEffectsMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the booking-effects-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the booking-effects-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the booking-effects-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
