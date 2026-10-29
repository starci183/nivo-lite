import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentDraftingMessageOptions } from "./content-drafting-message.options"

/** The configurable-module base of the content-drafting-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentDraftingMessageOptions>().setClassMethodName("register").build()
