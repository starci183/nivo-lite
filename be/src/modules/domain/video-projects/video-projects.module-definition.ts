import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoProjectsOptions } from "./video-projects.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoProjectsOptions>()
