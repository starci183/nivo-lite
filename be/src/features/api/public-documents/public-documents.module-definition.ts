import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PublicDocumentsApiOptions } from "./public-documents.options"

type Host = ConfigurableModuleHost<PublicDocumentsApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PublicDocumentsApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the public-documents feature. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the public-documents feature. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the public-documents feature. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
