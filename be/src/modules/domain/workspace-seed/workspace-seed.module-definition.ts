import { defineCapabilityModule } from "@starci/nest-kit"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkspaceSeedOptions>({
    optionsInjectionToken: WORKSPACE_SEED_OPTIONS,
})
