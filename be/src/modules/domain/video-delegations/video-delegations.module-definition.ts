import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoDelegationsOptions } from "./video-delegations.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoDelegationsOptions>()
