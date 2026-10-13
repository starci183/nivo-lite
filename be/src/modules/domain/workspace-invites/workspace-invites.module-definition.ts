import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"

/** The configurable-module base of the workspace-invites capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkspaceInvitesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
