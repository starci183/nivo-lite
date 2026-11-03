import { defineConfigurableModule } from "@starci/nest-kit"
import type { ThreadOutcomesMessageOptions } from "./thread-outcomes-message.options"

/** The configurable-module base of the thread-outcomes-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ThreadOutcomesMessageOptions>()
