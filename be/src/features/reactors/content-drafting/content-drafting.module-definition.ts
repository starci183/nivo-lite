import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentDraftingOptions } from "./content-drafting.options"

/** The configurable-module base of the content-drafting module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentDraftingOptions>().setClassMethodName("register").build()
