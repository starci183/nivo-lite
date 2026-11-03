import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OfficeCommandCandidatesOptions } from "./office-command-candidates.options"

/** The configurable-module base of the office capability. */
const definition = new ConfigurableModuleBuilder<OfficeCommandCandidatesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    OfficeCommandCandidatesOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: OfficeCommandCandidatesOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
