import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

/** The configurable-module base of the workspace-invites capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<WorkspaceInvitesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkspaceInvitesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkspaceInvitesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
