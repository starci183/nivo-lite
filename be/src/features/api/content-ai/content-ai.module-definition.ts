import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentAiApiOptions } from "./content-ai.options"

/** The configurable-module base of the content-ai module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentAiApiOptions>()
