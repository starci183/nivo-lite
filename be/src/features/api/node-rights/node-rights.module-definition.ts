import { defineConfigurableModule } from "@starci/nest-kit"
import type { NodeRightsApiOptions } from "./node-rights.options"

/** The configurable-module base of the node rights module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<NodeRightsApiOptions>()
