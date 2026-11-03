import { defineCapabilityModule } from "@starci/nest-kit"
import type { AvatarsOptions } from "./avatars.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AvatarsOptions>()
