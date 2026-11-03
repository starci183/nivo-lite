import { defineConfigurableModule } from "@starci/nest-kit"
import type { AdminApiOptions } from "./admin.options"

/** The configurable-module base of the admin module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AdminApiOptions>()
