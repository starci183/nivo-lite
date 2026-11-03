import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatMarkersApiOptions } from "./chatmarkers.options"

/** The configurable base of the chat markers feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatMarkersApiOptions>()
