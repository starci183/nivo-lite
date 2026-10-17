import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublishContentQueueOptions } from "./publish-content-queue.options"

/** The configurable-module base of the publish-content-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublishContentQueueOptions>().setClassMethodName("register").build()
