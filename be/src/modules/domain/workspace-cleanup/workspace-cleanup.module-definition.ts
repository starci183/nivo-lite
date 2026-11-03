import { defineCapabilityModule } from "@starci/nest-kit"
import { WORKSPACE_CLEANUP_OPTIONS } from "./workspace-cleanup.decorators"
import type { WorkspaceCleanupOptions } from "./workspace-cleanup.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceCleanupOptions>({
    optionsInjectionToken: WORKSPACE_CLEANUP_OPTIONS,
})
