import { defineConfigurableModule } from "@starci/nest-kit"
import type { EvidenceApiOptions } from "./evidence.options"

/** The configurable-module base of the evidence module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<EvidenceApiOptions>()
