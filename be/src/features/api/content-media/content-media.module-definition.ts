import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentMediaApiOptions } from "./content-media.options"

/** The configurable-module base of the content-media module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentMediaApiOptions>().setClassMethodName("register").build()
