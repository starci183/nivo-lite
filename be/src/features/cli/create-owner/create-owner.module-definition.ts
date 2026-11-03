import { defineConfigurableModule } from "@starci/nest-kit"
import type { CreateOwnerOptions } from "./create-owner.options"

/** The configurable-module base of the create-owner module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CreateOwnerOptions>()
