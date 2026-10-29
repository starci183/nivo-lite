import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SourceFactsMessageOptions } from "./source-facts-message.options"

/** The configurable-module base of the source-facts-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SourceFactsMessageOptions>().setClassMethodName("register").build()
