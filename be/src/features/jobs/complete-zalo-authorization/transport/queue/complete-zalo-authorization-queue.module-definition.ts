import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CompleteZaloAuthorizationQueueOptions } from "./complete-zalo-authorization-queue.options"

/** The configurable-module base of the complete-zalo-authorization-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CompleteZaloAuthorizationQueueOptions>().setClassMethodName("register").build()
