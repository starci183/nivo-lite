import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverWorkflowStartOptions } from "./deliver-workflow-start.options"

/** The configurable-module base of the workflow-start job module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverWorkflowStartOptions>()
