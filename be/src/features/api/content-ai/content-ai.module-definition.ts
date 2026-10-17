import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentAiApiOptions } from "./content-ai.options"

/** The configurable-module base of the content-ai module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentAiApiOptions>().setClassMethodName("register").build()
