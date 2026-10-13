import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BrainOptions } from "./brain.options"

/** Token of the options of the brain capability, exported so a spec can provide it. */
export const BRAIN_OPTIONS: unique symbol = Symbol("domain.brain.options")

/** Injects the options of the brain capability. Parameter type: BrainOptions. */
export const InjectBrainOptions = (): TypedParameterDecorator<BrainOptions> => injector<BrainOptions>(BRAIN_OPTIONS)
