import { ConfigurableModuleBuilder } from "@nestjs/common"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** The configurable-module base of the workspace-seed capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WorkspaceSeedOptions>({
    optionsInjectionToken: WORKSPACE_SEED_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
