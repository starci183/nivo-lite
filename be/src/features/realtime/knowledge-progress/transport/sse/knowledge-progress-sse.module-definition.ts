import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { KnowledgeProgressSseOptions } from "./knowledge-progress-sse.options"

type Host = ConfigurableModuleHost<KnowledgeProgressSseOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<KnowledgeProgressSseOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the knowledge-progress-sse module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass
