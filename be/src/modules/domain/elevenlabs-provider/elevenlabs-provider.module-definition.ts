import { defineCapabilityModule } from "@starci/nest-kit"
import type { ElevenLabsProviderOptions } from "./elevenlabs-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ElevenLabsProviderOptions>()
