import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ReviewDossiersOptions } from "./review-dossiers.options"

type Host = ConfigurableModuleHost<ReviewDossiersOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ReviewDossiersOptions>().setClassMethodName("register").build()

/** The configurable-module base of the review-dossiers module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the review-dossiers module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the review-dossiers module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
