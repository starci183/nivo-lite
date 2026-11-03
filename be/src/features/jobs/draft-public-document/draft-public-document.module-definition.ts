import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DraftPublicDocumentOptions } from "./draft-public-document.options"

type Host = ConfigurableModuleHost<DraftPublicDocumentOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DraftPublicDocumentOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the draft-public-document module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the draft-public-document module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the draft-public-document module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
