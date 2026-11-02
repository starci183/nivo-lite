import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DraftPublicDocumentOptions } from "./draft-public-document.options"

/** The configurable-module base of the draft-public-document module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DraftPublicDocumentOptions>().setClassMethodName("register").build()
