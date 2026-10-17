import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SeedWorkspaceOptions } from "./seed-workspace.options"

/** The configurable-module base of the seed-workspace module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SeedWorkspaceOptions>().setClassMethodName("register").build()
