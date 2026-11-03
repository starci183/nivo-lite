import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { WORKSPACE_CLEANUP_OPTIONS } from "./workspace-cleanup.decorators"
import type { WorkspaceCleanupOptions } from "./workspace-cleanup.options"

/** The configurable-module base of the workspace-cleanup capability. */
const definition = new ConfigurableModuleBuilder<WorkspaceCleanupOptions>({
    optionsInjectionToken: WORKSPACE_CLEANUP_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkspaceCleanupOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkspaceCleanupOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
