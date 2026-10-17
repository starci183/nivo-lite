import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublishContentOptions } from "./publish-content.options"

/** The configurable-module base of the publish-content module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublishContentOptions>().setClassMethodName("register").build()
