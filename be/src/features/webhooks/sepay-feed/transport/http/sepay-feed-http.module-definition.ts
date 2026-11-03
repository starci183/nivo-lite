import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SepayFeedHttpOptions } from "./sepay-feed-http.options"

type Host = ConfigurableModuleHost<SepayFeedHttpOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SepayFeedHttpOptions>().setClassMethodName("register").build()

/** The configurable-module base of the sepay-feed-http module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the sepay-feed-http module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the sepay-feed-http module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
