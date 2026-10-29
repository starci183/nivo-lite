import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CreateOwnerOptions } from "./create-owner.options"

/** The configurable-module base of the create-owner module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CreateOwnerOptions>().setClassMethodName("register").build()
