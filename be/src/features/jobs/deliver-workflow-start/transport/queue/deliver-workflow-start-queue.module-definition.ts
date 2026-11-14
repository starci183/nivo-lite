import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverWorkflowStartQueueOptions } from "./deliver-workflow-start-queue.options"

/** The configurable-module base of the workflow-start-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverWorkflowStartQueueOptions>()
