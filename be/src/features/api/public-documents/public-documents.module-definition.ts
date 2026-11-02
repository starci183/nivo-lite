import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicDocumentsApiOptions } from "./public-documents.options"

/** The configurable-module base of the public-documents feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublicDocumentsApiOptions>().setClassMethodName("register").build()
