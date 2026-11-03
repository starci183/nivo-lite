import { defineConfigurableModule } from "@starci/nest-kit"
import type { InboxApiOptions } from "./inbox.options"

/** The configurable-module base of the inbox module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InboxApiOptions>()
