import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PublicBookingGraphqlOptions } from "./public-booking-graphql.options"

type Host = ConfigurableModuleHost<PublicBookingGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PublicBookingGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the public-booking-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the public-booking-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the public-booking-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
