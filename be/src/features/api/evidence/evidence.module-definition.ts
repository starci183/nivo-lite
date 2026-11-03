import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { EvidenceApiOptions } from "./evidence.options"

type Host = ConfigurableModuleHost<EvidenceApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<EvidenceApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the evidence module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the evidence module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the evidence module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
