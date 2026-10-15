import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BrainOptions } from "./brain.options"
import type { CorrectionSource } from "./brain.contracts"

/** Token of the options of the brain capability, exported so a spec can provide it. */
export const BRAIN_OPTIONS: unique symbol = Symbol("domain.brain.options")

/** Injects the options of the brain capability. Parameter type: BrainOptions. */
export const InjectBrainOptions = (): TypedParameterDecorator<BrainOptions> => injector<BrainOptions>(BRAIN_OPTIONS)

/** Token of the decisions source the brain studies. */
export const BRAIN_CORRECTIONS: unique symbol = Symbol("domain.brain.corrections")

/** Injects the owner's corrections. Parameter type: CorrectionSource. */
export const InjectCorrectionSource = (): TypedParameterDecorator<CorrectionSource> =>
    injector<CorrectionSource>(BRAIN_CORRECTIONS)
