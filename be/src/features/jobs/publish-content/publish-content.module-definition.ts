import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublishContentOptions } from "./publish-content.options"

/** The configurable-module base of the publish-content module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublishContentOptions>()
