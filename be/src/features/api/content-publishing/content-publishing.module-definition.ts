import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentPublishingApiOptions } from "./content-publishing.options"

/** The configurable-module base of the content-publishing module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentPublishingApiOptions>().setClassMethodName("register").build()
