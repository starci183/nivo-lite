import { ConfigurableModuleBuilder } from "@nestjs/common"
import { WORKSPACE_CLEANUP_OPTIONS } from "./workspace-cleanup.decorators"
import type { WorkspaceCleanupOptions } from "./workspace-cleanup.options"

/** The configurable-module base of the workspace-cleanup capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkspaceCleanupOptions>({
    optionsInjectionToken: WORKSPACE_CLEANUP_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
