import { defineConfigurableModule } from "@starci/nest-kit"
import type { PublishContentQueueOptions } from "./publish-content-queue.options"

/** The configurable-module base of the publish-content-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PublishContentQueueOptions>()
