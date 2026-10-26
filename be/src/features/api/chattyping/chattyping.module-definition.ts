import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChattypingApiOptions } from "./chattyping.options"

/** The configurable-module base of the typing API feature. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<ChattypingApiOptions>()
    .setClassMethodName("register")
    .build()
