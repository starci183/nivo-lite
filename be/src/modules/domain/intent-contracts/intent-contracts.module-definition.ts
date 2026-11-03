import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { IntentContractsOptions } from "./intent-contracts.options"

/** The configurable-module base of the intent-contracts capability. */
const definition = new ConfigurableModuleBuilder<IntentContractsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    IntentContractsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: IntentContractsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
