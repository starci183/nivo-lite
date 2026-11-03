import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContractsOptions } from "./contracts.options"

/** The configurable-module base of the contracts capability. */
const definition = new ConfigurableModuleBuilder<ContractsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContractsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContractsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
