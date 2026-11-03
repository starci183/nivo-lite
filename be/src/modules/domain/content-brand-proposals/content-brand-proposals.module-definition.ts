import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentBrandProposalsOptions } from "./content-brand-proposals.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentBrandProposalsOptions>()
