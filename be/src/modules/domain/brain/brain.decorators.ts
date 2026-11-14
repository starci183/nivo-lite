import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { BrainOptions } from "./brain.options"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { CorrectionSource } from "./brain.contracts"
import { TRUTH_CRITIQUE_GATE, type TruthCritiqueGate } from "./direct-apply.policy"

/** Token of the critic's verdict reader, exported so a spec can provide it. */
export { TRUTH_CRITIQUE_GATE }

/** Token of the options of the brain capability, exported so a spec can provide it. */
export const BRAIN_OPTIONS: unique symbol = Symbol("domain.brain.options")

/** Injects the options of the brain capability. Parameter type: BrainOptions. */
export const InjectBrainOptions = (): TypedParameterDecorator<BrainOptions> => injector<BrainOptions>(BRAIN_OPTIONS)

/** Token of the decisions source the brain studies. */
export const BRAIN_CORRECTIONS: unique symbol = Symbol("domain.brain.corrections")

/** Injects the owner's corrections. Parameter type: CorrectionSource. */
export const InjectCorrectionSource = (): TypedParameterDecorator<CorrectionSource> =>
    injector<CorrectionSource>(BRAIN_CORRECTIONS)

/** Injects what reads the critic's verdict on a document's passages. Parameter type: TruthCritiqueGate. */
export const InjectTruthCritiqueGate = (): TypedParameterDecorator<TruthCritiqueGate> =>
    injector<TruthCritiqueGate>(TRUTH_CRITIQUE_GATE)

/** Token of the cross-scope rivals of waiting truths (bound by the verification owner: `TruthRivalsService`, its scope relation). */
export const TRUTH_RIVALS: unique symbol = Symbol("domain.brain.truth-rivals")

/**
 * Which of a document's waiting truths another truth of ANOTHER key contests, by the verification owner's relation (a broader or
 * narrower scope of the same thing, `dossier-review/truth-scope.policy.ts`; the brain defines none of its own). Answers their ids.
 */
export interface TruthRivals {
    /** The ids among `facts` that a waiting or in-force truth of another key contests. */
    contestedAmong(workspaceId: string, facts: ReadonlyArray<FactRecord>): Promise<ReadonlySet<string>>
}

/** Injects the cross-scope rivals reader. Parameter type: TruthRivals. */
export const InjectTruthRivals = (): TypedParameterDecorator<TruthRivals> => injector<TruthRivals>(TRUTH_RIVALS)
