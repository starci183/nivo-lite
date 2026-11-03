import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunMarketingTickOptions } from "./run-marketing-tick.options"

type Host = ConfigurableModuleHost<RunMarketingTickOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunMarketingTickOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-marketing-tick module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-marketing-tick module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-marketing-tick module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
