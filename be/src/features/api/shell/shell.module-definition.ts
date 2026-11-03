import { defineConfigurableModule } from "@starci/nest-kit"
import type { ShellApiOptions } from "./shell.options"

/** The configurable-module base of the shell module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ShellApiOptions>()
