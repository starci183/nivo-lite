import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChattypingApiOptions } from "./chattyping.options"

type Host = ConfigurableModuleHost<ChattypingApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChattypingApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the typing API feature. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass
