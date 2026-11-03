import { defineConfigurableModule } from "@starci/nest-kit"
import type { RendersApiOptions } from "./renders.options"

/** The configurable-module base of the renders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RendersApiOptions>()
