import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentApiOptions } from "./content.options"

/** The configurable-module base of the content module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentApiOptions>().setClassMethodName("register").build()
