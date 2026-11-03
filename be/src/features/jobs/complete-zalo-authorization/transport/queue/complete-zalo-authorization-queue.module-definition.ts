import { defineConfigurableModule } from "@starci/nest-kit"
import type { CompleteZaloAuthorizationQueueOptions } from "./complete-zalo-authorization-queue.options"

/** The configurable-module base of the complete-zalo-authorization-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CompleteZaloAuthorizationQueueOptions>()
