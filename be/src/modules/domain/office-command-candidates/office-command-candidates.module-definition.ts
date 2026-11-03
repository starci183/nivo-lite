import { defineCapabilityModule } from "@starci/nest-kit"
import type { OfficeCommandCandidatesOptions } from "./office-command-candidates.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OfficeCommandCandidatesOptions>()
