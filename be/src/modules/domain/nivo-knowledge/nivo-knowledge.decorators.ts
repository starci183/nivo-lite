import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NivoKnowledgeOptions } from "./nivo-knowledge.options"

/** Token of the options of the nivo-knowledge capability, exported so a spec can provide it. */
export const NIVO_KNOWLEDGE_OPTIONS: unique symbol = Symbol("domain.nivo-knowledge.options")

/** Injects the options of the nivo-knowledge capability. Parameter type: NivoKnowledgeOptions. */
export const InjectNivoKnowledgeOptions = (): TypedParameterDecorator<NivoKnowledgeOptions> =>
    injector<NivoKnowledgeOptions>(NIVO_KNOWLEDGE_OPTIONS)
