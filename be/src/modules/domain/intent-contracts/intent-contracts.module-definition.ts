import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IntentContractsOptions } from "./intent-contracts.options"

/** The configurable-module base of the intent-contracts capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<IntentContractsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
