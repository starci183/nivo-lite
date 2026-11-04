import { hasSignal, holds, scoreCandidates } from "./evidence"
import type {
    Arrival,
    Candidate,
    Claim,
    Effect,
    EffectHandlers,
    EvidenceOptions,
    Evidenced,
    Judge,
    Judgement,
    Outcome,
} from "./reconcile.types"

/** The reasons the rules themselves give, as stable codes the host words for a person. */
export const REASON = {
    codeAndAmount: "code_and_amount",
    codeAmountDiffers: "code_amount_differs",
    codeAmbiguous: "code_ambiguous",
    noEvidence: "no_evidence",
    judgeUnavailable: "judge_unavailable",
    judgeNamedNone: "judge_named_none",
    amountDiffers: "amount_differs",
} as const

/** An outcome the code rule gives: the match is applied, or a person is asked; the rule never leaves an arrival. */
export type CodeOutcome = Omit<Outcome, "effect"> & {
    readonly effect: Extract<Effect, { readonly kind: "apply" | "ask" }>
}

const codeNamed = (list: ReadonlyArray<Evidenced>): ReadonlyArray<Evidenced> => list.filter((one) => holds(one, "code"))

const idsOf = (list: ReadonlyArray<Evidenced>): ReadonlyArray<string> => list.map((one) => one.candidate.id)

const outcomeOf = <E extends Effect>(
    candidates: ReadonlyArray<Evidenced>,
    rest: Omit<Outcome, "candidates" | "effect"> & { readonly effect: E },
): Omit<Outcome, "effect"> & { readonly effect: E } => ({ ...rest, candidates })

/** The first pass, with no model: a code in the text that names exactly one candidate decides, if the amount is the amount due. */
export const decideByCode = (candidates: ReadonlyArray<Evidenced>): CodeOutcome | null => {
    const named = codeNamed(candidates)
    const [only] = named
    if (only === undefined) return null
    if (named.length > 1) {
        return outcomeOf(candidates, {
            stage: "code",
            effect: { kind: "ask", candidateIds: idsOf(named) },
            reasons: [REASON.codeAmbiguous],
        })
    }
    return holds(only, "amount")
        ? outcomeOf(candidates, {
              stage: "code",
              effect: { kind: "apply", candidateId: only.candidate.id },
              reasons: [REASON.codeAndAmount],
          })
        : outcomeOf(candidates, {
              stage: "code",
              effect: { kind: "ask", candidateIds: [only.candidate.id] },
              reasons: [REASON.codeAmountDiffers],
          })
}

/** A match is only taken when it names a candidate that was offered and whose amount is the amount due: anything else is for a person. */
export const outcomeOfJudgement = (candidates: ReadonlyArray<Evidenced>, judgement: Judgement): Outcome => {
    const reasons = judgement.reasons
    if (judgement.verdict === "no_match") {
        return outcomeOf(candidates, { stage: "judge", effect: { kind: "leave" }, reasons })
    }
    const named = candidates.find((one) => one.candidate.id === judgement.candidateId)
    if (judgement.verdict === "match" && named !== undefined) {
        if (holds(named, "amount")) {
            return outcomeOf(candidates, {
                stage: "judge",
                effect: { kind: "apply", candidateId: named.candidate.id },
                reasons,
            })
        }
        return outcomeOf(candidates, {
            stage: "judge",
            effect: { kind: "ask", candidateIds: [named.candidate.id] },
            reasons: [...reasons, REASON.amountDiffers],
        })
    }
    const pool = candidates.filter(hasSignal)
    return outcomeOf(candidates, { stage: "judge", effect: { kind: "ask", candidateIds: idsOf(pool) }, reasons })
}

/** The case for a person when the judge could not answer: every candidate that shows evidence is offered. */
export const outcomeWithoutJudge = (candidates: ReadonlyArray<Evidenced>): Outcome =>
    outcomeOf(candidates, {
        stage: "judge_unavailable",
        effect: { kind: "ask", candidateIds: idsOf(candidates.filter(hasSignal)) },
        reasons: [REASON.judgeUnavailable],
    })

/** The outcome when no candidate shows any evidence: the arrival is left as it is, with no judge asked. */
export const outcomeWithoutEvidence = (candidates: ReadonlyArray<Evidenced>): Outcome =>
    outcomeOf(candidates, { stage: "no_evidence", effect: { kind: "leave" }, reasons: [REASON.noEvidence] })

/**
 * Decides what to do about an arrival: the code and amount rule first; when no candidate shows any evidence at all, leave it with no
 * model call; otherwise the judge reads the evidence and a match, an ambiguity or a refusal becomes an effect. A judge that cannot
 * answer, or names a candidate that was not offered, makes the case one for a person: money is never applied on a guess.
 */
export const judgeAndEffect = async (
    arrival: Arrival,
    candidates: ReadonlyArray<Candidate>,
    claims: ReadonlyArray<Claim>,
    judge: Judge,
    options: EvidenceOptions,
): Promise<Outcome> => {
    const scored = scoreCandidates(arrival, candidates, claims, options)
    const decided = decideByCode(scored)
    if (decided !== null) return decided
    const signalled = scored.filter(hasSignal)
    if (signalled.length === 0) return outcomeWithoutEvidence(scored)
    const judgement = await judge({ arrival, candidates: signalled, claims })
    if (judgement === null) return outcomeWithoutJudge(scored)
    return outcomeOfJudgement(scored, judgement)
}

/** Runs the handler the host registered for the outcome's effect. */
export const runEffect = <T>(outcome: Outcome, handlers: EffectHandlers<T>): Promise<T> => {
    const { effect } = outcome
    if (effect.kind === "apply") return handlers.apply(effect.candidateId, outcome)
    if (effect.kind === "ask") return handlers.ask(effect.candidateIds, outcome)
    return handlers.leave(outcome)
}
