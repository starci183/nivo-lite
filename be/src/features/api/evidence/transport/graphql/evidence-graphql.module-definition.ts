import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EvidenceGraphqlOptions } from "./evidence-graphql.options"

/** The configurable-module base of the evidence-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<EvidenceGraphqlOptions>().setClassMethodName("register").build()
