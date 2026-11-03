import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/** The configurable-module base of the workspace-seed capability. */
const definition = new ConfigurableModuleBuilder<WorkspaceSeedOptions>({
    optionsInjectionToken: WORKSPACE_SEED_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WorkspaceSeedOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WorkspaceSeedOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
