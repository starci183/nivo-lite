import { defineConfigurableModule } from "@starci/nest-kit"
import type { FireThreadDeadlineOptions } from "./fire-thread-deadline.options"

/** The configurable-module base of the fire-thread-deadline module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<FireThreadDeadlineOptions>()
