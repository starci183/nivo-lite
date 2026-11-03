import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkspacesOptions } from "./workspaces.options"

/** The configurable-module base of the workspaces capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<WorkspacesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkspacesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkspacesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
