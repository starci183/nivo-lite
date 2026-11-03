import { defineCapabilityModule } from "@starci/nest-kit"
import type { LoyaltyCampaignsOptions } from "./loyalty-campaigns.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LoyaltyCampaignsOptions>()
