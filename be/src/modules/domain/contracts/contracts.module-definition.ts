import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContractsOptions } from "./contracts.options"

/** The configurable-module base of the contracts capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ContractsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
