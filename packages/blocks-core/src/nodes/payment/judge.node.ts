import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import {
    hasSignal,
    outcomeOfJudgement,
    outcomeWithoutEvidence,
    outcomeWithoutJudge,
} from "@nivo-lite/agent-sdk/reconcile"
import type { Arrival, Claim, Evidenced, Outcome } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"
import { ARRIVAL_DINH, ARRIVAL_MOMO, CLAIM_OF_DINH, EVIDENCED_FOR_DINH, EVIDENCED_FOR_MOMO } from "./payment.fixtures"
import { arrivalSchema, claimSchema, evidencedSchema, judgementAnswerSchema } from "./payment.schemas"
import type { Named } from "./payment.schemas"

/** What the judge reads: the transfer, the candidates with their evidence, and the open claims. */
interface JudgeInput {
    readonly arrival: Arrival
    readonly evidenced: ReadonlyArray<Evidenced>
    readonly claims: ReadonlyArray<Claim>
}

/** `match`: one order fits. `ambiguous`: a person decides among `candidateIds`. `no_match`: the transfer belongs to none. */
interface JudgeOutput extends Named {
    readonly branch: "match" | "ambiguous" | "no_match"
}

/** The node takes no settings. */
type NoParams = Record<string, never>

const input: z.ZodType<JudgeInput, JudgeInput> = z.object({
    arrival: arrivalSchema,
    evidenced: z.array(evidencedSchema),
    claims: z.array(claimSchema),
})
const output: z.ZodType<JudgeOutput, JudgeOutput> = z.object({
    branch: z.enum(["match", "ambiguous", "no_match"]),
    candidateIds: z.array(z.string()),
    reasons: z.array(z.string()),
})

const INSTRUCTIONS = [
    "You reconcile one incoming bank transfer to the open sales orders of a small shop.",
    "You get the transfer (amount, transfer content, counter name, time), the open orders with the evidence already checked for each, and what the customers said about paying.",
    "Answer with a JSON object: verdict (match | no_match | ambiguous), candidate_id (the id of the order a match names, else null) and reasons (up to four short sentences).",
    "Answer match only when exactly one order fits: the amount equals the amount due, and the payer name or the customer's claim points to that order's customer.",
    "Answer ambiguous when two or more orders fit, or when the evidence is thin or contradicts itself. Answer no_match when the transfer plainly belongs to none of them.",
    "Never guess: a wrong match marks an order paid. Names are compared without diacritics or case. Write the reasons in the language of the shop (Vietnamese).",
].join("\n")

const iso = (at: number): string => new Date(at).toISOString()

/** The evidence as the model reads it: plain JSON of the transfer, the orders with their checks, and the claims. */
const briefOf = (given: JudgeInput, signalled: ReadonlyArray<Evidenced>): unknown => ({
    transfer: {
        amount: given.arrival.amount,
        content: given.arrival.text,
        names: given.arrival.names,
        at: iso(given.arrival.at),
    },
    orders: signalled.map((one) => ({
        id: one.candidate.id,
        order: one.candidate.label,
        amount_due: one.candidate.amountDue,
        customer: one.candidate.partyName,
        opened_at: iso(one.candidate.openedAt),
        evidence: one.evidence.map((item) => ({ check: item.key, holds: item.met, detail: item.detail })),
    })),
    customer_claims: given.claims.map((claim) => ({
        customer: claim.partyKey,
        amount: claim.amount,
        names: claim.names,
        said: claim.text,
        at: iso(claim.at),
    })),
})

const outputOf = (outcome: Outcome): JudgeOutput => {
    const { effect, reasons } = outcome
    if (effect.kind === "apply") return { branch: "match", candidateIds: [effect.candidateId], reasons }
    if (effect.kind === "ask") return { branch: "ambiguous", candidateIds: effect.candidateIds, reasons }
    return { branch: "no_match", candidateIds: [], reasons }
}

/**
 * The AI judgement of a transfer the code rule could not place, a condition with three branches. A transfer no order shows any evidence for
 * is `no_match` with no model call. Otherwise the host's model answers match, no_match or ambiguous with reasons, and the reasons travel on.
 * A match is taken only when it names an order that was offered and whose amount is the amount due; a match with another amount, a model
 * that is unavailable and an answer in a shape that does not fit all route to `ambiguous`, so money is never matched on a guess.
 */
export const paymentJudgeNode: NodeDefinition<
    z.ZodType<JudgeInput, JudgeInput>,
    z.ZodType<JudgeOutput, JudgeOutput>,
    z.ZodType<NoParams>
> = defineNode({
    id: "payment.judge",
    role: "condition",
    title: { key: "paymentJudge" },
    params: z.object({}),
    input,
    output,
    rights: [],
    effects: [],
    run: async (given, context) => {
        if (!given.evidenced.some(hasSignal)) return outputOf(outcomeWithoutEvidence(given.evidenced))
        const signalled = given.evidenced.filter(hasSignal)
        try {
            const answer = await context.model.json(judgementAnswerSchema, {
                purpose: "payment-judge",
                instructions: INSTRUCTIONS,
                input: briefOf(given, signalled),
            })
            return outputOf(
                outcomeOfJudgement(given.evidenced, {
                    verdict: answer.verdict,
                    candidateId: answer.candidate_id,
                    reasons: answer.reasons,
                }),
            )
        } catch {
            return outputOf(outcomeWithoutJudge(given.evidenced))
        }
    },
    examples: [
        {
            name: "the claim at 00:54 came before the money at 01:06: the model matches Định's order",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [
                {
                    verdict: "match",
                    candidate_id: "order-dinh",
                    reasons: ["Tên, số tiền và lời báo của khách khớp đơn SO-0001"],
                },
            ],
            output: {
                branch: "match",
                candidateIds: ["order-dinh"],
                reasons: ["Tên, số tiền và lời báo của khách khớp đơn SO-0001"],
            },
            effects: [],
        },
        {
            name: "the unrelated 2,000 MoMo transfer shows no evidence: no_match, and the model is not asked",
            params: {},
            input: { arrival: ARRIVAL_MOMO, evidenced: [...EVIDENCED_FOR_MOMO], claims: [CLAIM_OF_DINH] },
            output: { branch: "no_match", candidateIds: [], reasons: ["no_evidence"] },
            effects: [],
        },
        {
            name: "the model says the transfer is another person's: no_match",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [] },
            model: [{ verdict: "no_match", candidate_id: null, reasons: ["Người chuyển là người khác"] }],
            output: { branch: "no_match", candidateIds: [], reasons: ["Người chuyển là người khác"] },
            effects: [],
        },
        {
            name: "the model finds the case ambiguous: the owner decides",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [{ verdict: "ambiguous", candidate_id: null, reasons: ["Hai đơn cùng số tiền"] }],
            output: { branch: "ambiguous", candidateIds: ["order-dinh"], reasons: ["Hai đơn cùng số tiền"] },
            effects: [],
        },
        {
            name: "an answer that does not fit the schema is ambiguous, never a match",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [{ verdict: "probably" }],
            output: { branch: "ambiguous", candidateIds: ["order-dinh"], reasons: ["judge_unavailable"] },
            effects: [],
        },
    ],
})
