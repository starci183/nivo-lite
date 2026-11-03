import { defineConfigurableModule } from "@starci/nest-kit"
import type { AcceptMetaEventOptions } from "./accept-meta-event.options"

/** The configurable-module base of the accept-meta-event module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AcceptMetaEventOptions>()
