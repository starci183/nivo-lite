import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedWorkspaceOptions } from "./seed-workspace.options"

/** The configurable-module base of the seed-workspace module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedWorkspaceOptions>()
