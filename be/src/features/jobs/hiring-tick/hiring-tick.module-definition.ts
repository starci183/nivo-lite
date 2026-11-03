import { defineConfigurableModule } from "@starci/nest-kit"
import type { HiringTickOptions } from "./hiring-tick.options"

/** The configurable-module base of the hiring-tick module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<HiringTickOptions>()
