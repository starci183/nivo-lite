import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkspaceMembersOptions } from "./workspace-members.options"

/** The configurable-module base of the workspace-members capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkspaceMembersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
