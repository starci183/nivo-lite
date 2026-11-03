import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkspaceMembersOptions } from "./workspace-members.options"

/** The configurable-module base of the workspace-members capability. */
const definition = new ConfigurableModuleBuilder<WorkspaceMembersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkspaceMembersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkspaceMembersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
