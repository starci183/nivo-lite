import { defineConfigurableModule } from "@starci/nest-kit"
import type { OverviewApiOptions } from "./overview.options"

/** The configurable-module base of the overview module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OverviewApiOptions>()
