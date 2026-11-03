import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PublicBookingApiOptions } from "./public-booking.options"

type Host = ConfigurableModuleHost<PublicBookingApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PublicBookingApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the public-booking module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the public-booking module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the public-booking module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
