import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkspacesOptions } from "./workspaces.options"

/** The configurable-module base of the workspaces capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkspacesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
