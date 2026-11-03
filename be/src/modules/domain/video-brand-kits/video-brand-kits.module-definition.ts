import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoBrandKitsOptions } from "./video-brand-kits.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoBrandKitsOptions>()
