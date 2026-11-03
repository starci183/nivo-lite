import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChannelReceiptsOptions } from "./channel-receipts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChannelReceiptsOptions>()
