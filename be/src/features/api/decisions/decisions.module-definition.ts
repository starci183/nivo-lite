import { defineConfigurableModule } from "@starci/nest-kit"
import type { DecisionsApiOptions } from "./decisions.options"

/** The configurable-module base of the decisions module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DecisionsApiOptions>()
