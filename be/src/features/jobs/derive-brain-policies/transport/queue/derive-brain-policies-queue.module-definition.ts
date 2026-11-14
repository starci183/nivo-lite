import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeriveBrainPoliciesQueueOptions } from "./derive-brain-policies-queue.options"

/** The configurable-module base of the derive-brain-policies-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeriveBrainPoliciesQueueOptions>()
