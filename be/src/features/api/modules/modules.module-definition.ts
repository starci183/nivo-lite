import { defineConfigurableModule } from "@starci/nest-kit"
import type { ModulesApiOptions } from "./modules.options"

/** The configurable-module base of the modules module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ModulesApiOptions>()
