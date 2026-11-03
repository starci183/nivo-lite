import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoProjectVersionsOptions } from "./video-project-versions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoProjectVersionsOptions>()
