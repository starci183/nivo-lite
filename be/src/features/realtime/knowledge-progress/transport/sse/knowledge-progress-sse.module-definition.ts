import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { KnowledgeProgressSseOptions } from "./knowledge-progress-sse.options"

/** The configurable-module base of the knowledge-progress-sse module. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<KnowledgeProgressSseOptions>()
    .setClassMethodName("register")
    .build()
