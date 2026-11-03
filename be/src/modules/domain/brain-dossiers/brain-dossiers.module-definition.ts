import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BrainDossiersOptions } from "./brain-dossiers.options"

/** The configurable-module base of the brain-dossiers capability. */
const definition = new ConfigurableModuleBuilder<BrainDossiersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BrainDossiersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BrainDossiersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
