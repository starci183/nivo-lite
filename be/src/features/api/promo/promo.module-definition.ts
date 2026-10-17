import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PromoApiOptions } from "./promo.options"

/** The configurable-module base of the promo module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PromoApiOptions>().setClassMethodName("register").build()
