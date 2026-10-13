import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { KnowledgeOptions } from "./knowledge.options"

/** Token of the options of the knowledge capability, exported so a spec can provide it. */
export const KNOWLEDGE_OPTIONS: unique symbol = Symbol("domain.knowledge.options")

/** Injects the options of the knowledge capability. Parameter type: KnowledgeOptions. */
export const InjectKnowledgeOptions = (): TypedParameterDecorator<KnowledgeOptions> =>
    injector<KnowledgeOptions>(KNOWLEDGE_OPTIONS)
