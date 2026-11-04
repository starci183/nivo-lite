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
import { failureKindOf } from "../core/failure.policy"
import {
    ARRIVAL_DINH,
    ARRIVAL_MOMO,
    CLAIM_OF_DINH,
    CLAIM_OF_MOMO,
    EVIDENCED_FOR_DINH,
    EVIDENCED_FOR_MOMO,
    EVIDENCED_FOR_MOMO_CLAIM,
} from "./payment.fixtures"
import { arrivalSchema, claimSchema, evidencedSchema, judgementAnswerSchema } from "./payment.schemas"
import type { Named } from "./payment.schemas"
import { MAX_BODY, MAX_ENTRIES, MAX_ID } from "../../bounds"
import { sampleOf } from "../../messages/catalog"

/** What the judge reads: the transfer (none while a claim waits for its money), the candidates with their evidence, and the open claims. */
interface JudgeInput {
    readonly arrival: Arrival | null
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
    arrival: arrivalSchema.nullable(),
    evidenced: z.array(evidencedSchema).max(MAX_ENTRIES),
    claims: z.array(claimSchema).max(MAX_ENTRIES),
})
const output: z.ZodType<JudgeOutput, JudgeOutput> = z.object({
    branch: z.enum(["match", "ambiguous", "no_match"]),
    candidateIds: z.array(z.string().max(MAX_ID)).max(MAX_ENTRIES),
    reasons: z.array(z.string().max(MAX_BODY)).max(MAX_ENTRIES),
})

const INSTRUCTIONS = [
    "You reconcile one incoming bank transfer to the open sales orders of a small shop.",
    "You get the transfer (amount, transfer content, counter name, time), the open orders with the evidence already checked for each, and what the customers said about paying.",
    "Answer with a JSON object: verdict (match | no_match | ambiguous), candidate_id (the id of the order a match names, else null) and reasons (up to four short sentences).",
    "Answer match only when exactly one order fits: the amount equals the amount due, and the payer name or the customer's claim points to that order's customer.",
    "Answer ambiguous when two or more orders fit, or when the evidence is thin or contradicts itself. Answer no_match when the transfer plainly belongs to none of them.",
    "Never guess: a wrong match marks an order paid. Names are compared without diacritics or case. Write the reasons in the language of the shop (Vietnamese).",
].join("\n")

/** The reason a failed model call leaves behind for the person who decides: the kind of the failure, never its text. */
const failureOf = (error: unknown): string => `judge_failed:${failureKindOf(error)}`

const iso = (at: number): string => new Date(at).toISOString()

/** The evidence as the model reads it: plain JSON of the transfer, the orders with their checks, and the claims. */
const briefOf = (given: JudgeInput & { readonly arrival: Arrival }, signalled: ReadonlyArray<Evidenced>): unknown => ({
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

const outputOf = (outcome: Outcome, failure: string | null = null): JudgeOutput => {
    const { effect } = outcome
    const reasons = failure === null ? outcome.reasons : [...outcome.reasons, failure]
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
        const { arrival } = given
        if (arrival === null || !given.evidenced.some(hasSignal)) {
            return outputOf(outcomeWithoutEvidence(given.evidenced))
        }
        const signalled = given.evidenced.filter(hasSignal)
        try {
            const answer = await context.model.json(judgementAnswerSchema, {
                purpose: "payment-judge",
                instructions: INSTRUCTIONS,
                input: briefOf({ ...given, arrival }, signalled),
            })
            return outputOf(
                outcomeOfJudgement(given.evidenced, {
                    verdict: answer.verdict,
                    candidateId: answer.candidate_id,
                    reasons: answer.reasons,
                }),
            )
        } catch (error) {
            return outputOf(outcomeWithoutJudge(given.evidenced), failureOf(error))
        }
    },
    examples: [
        {
            name: "the claim at 00:54 came before the money at 01:06: the model matches Dinh's order",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [
                {
                    verdict: "match",
                    candidate_id: "order-dinh",
                    reasons: [sampleOf("sampleTenSoTienVaLoiBao")],
                },
            ],
            output: {
                branch: "match",
                candidateIds: ["order-dinh"],
                reasons: [sampleOf("sampleTenSoTienVaLoiBao")],
            },
            effects: [],
        },
        {
            name: "the owner's 2,000 MoMo claim matches transfer 95937289 by amount but no order is for 2,000: ambiguous, the owner decides",
            params: {},
            input: { arrival: ARRIVAL_MOMO, evidenced: [...EVIDENCED_FOR_MOMO_CLAIM], claims: [CLAIM_OF_MOMO] },
            model: [{ verdict: "ambiguous", candidate_id: null, reasons: ["Số tiền khớp lời báo của khách nhưng không có đơn nào 2.000đ"] }],
            output: { branch: "ambiguous", candidateIds: ["order-dinh"], reasons: ["Số tiền khớp lời báo của khách nhưng không có đơn nào 2.000đ"] },
            effects: [],
        },
        {
            name: "a claim whose money has not arrived has no transfer to judge: no_match, and the model is not asked",
            params: {},
            input: { arrival: null, evidenced: [], claims: [CLAIM_OF_DINH] },
            output: { branch: "no_match", candidateIds: [], reasons: ["no_evidence"] },
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
            model: [{ verdict: "no_match", candidate_id: null, reasons: [sampleOf("sampleNguoiChuyenLaNguoiKhac")] }],
            output: { branch: "no_match", candidateIds: [], reasons: [sampleOf("sampleNguoiChuyenLaNguoiKhac")] },
            effects: [],
        },
        {
            name: "the model finds the case ambiguous: the owner decides",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [{ verdict: "ambiguous", candidate_id: null, reasons: [sampleOf("sampleHaiDonCungSoTien")] }],
            output: {
                branch: "ambiguous",
                candidateIds: ["order-dinh"],
                reasons: [sampleOf("sampleHaiDonCungSoTien")],
            },
            effects: [],
        },
        {
            name: "an answer that does not fit the schema is ambiguous, never a match",
            params: {},
            input: { arrival: ARRIVAL_DINH, evidenced: [...EVIDENCED_FOR_DINH], claims: [CLAIM_OF_DINH] },
            model: [{ verdict: "probably" }],
            output: {
                branch: "ambiguous",
                candidateIds: ["order-dinh"],
                reasons: ["judge_unavailable", "judge_failed:ZodError"],
            },
            effects: [],
        },
    ],
})
