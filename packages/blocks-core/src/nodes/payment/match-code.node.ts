import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { decideByCode } from "@nivo-lite/agent-sdk/reconcile"
import type { Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"
import {
    EVIDENCED_CODE_WRONG_AMOUNT,
    EVIDENCED_FOR_DINH,
    EVIDENCED_FOR_MOMO,
    EVIDENCED_WITH_CODE,
} from "./payment.fixtures"
import { evidencedSchema } from "./payment.schemas"
import type { Named } from "./payment.schemas"

/** The candidates with the evidence gathered for the transaction. */
interface MatchCodeInput {
    readonly evidenced: ReadonlyArray<Evidenced>
}

/** `matched`: the code names one order and the amount is its amount due. `mismatch`: a code names an order but the amount differs, or it names several. `no-code`: the content names no order. */
interface MatchCodeOutput extends Named {
    readonly branch: "matched" | "mismatch" | "no-code"
}

const input: z.ZodType<MatchCodeInput, MatchCodeInput> = z.object({ evidenced: z.array(evidencedSchema) })
const output: z.ZodType<MatchCodeOutput, MatchCodeOutput> = z.object({
    branch: z.enum(["matched", "mismatch", "no-code"]),
    candidateIds: z.array(z.string()),
    reasons: z.array(z.string()),
})

/**
 * The deterministic first pass, a condition. An order code in the transfer content that names exactly one order whose amount due is the
 * amount routes to `matched`. A code with another amount, or the codes of several orders, routes to `mismatch`: never marked paid
 * automatically, a person decides. A content that names no order routes to `no-code`, where the evidence and the judge decide.
 */
export const paymentMatchCodeNode: NodeDefinition<z.ZodType<MatchCodeInput, MatchCodeInput>, z.ZodType<MatchCodeOutput, MatchCodeOutput>> = defineNode({
    id: "payment.match-code",
    role: "condition",
    title: { key: "paymentMatchCode" },
    params: z.object({}),
    input,
    output,
    rights: [],
    effects: [],
    run: (given) => {
        const decided = decideByCode(given.evidenced)
        if (decided === null) return Promise.resolve({ branch: "no-code", candidateIds: [], reasons: [] })
        const { effect } = decided
        if (effect.kind === "apply") {
            return Promise.resolve({ branch: "matched", candidateIds: [effect.candidateId], reasons: decided.reasons })
        }
        return Promise.resolve({
            branch: "mismatch",
            candidateIds: effect.kind === "ask" ? effect.candidateIds : [],
            reasons: decided.reasons,
        })
    },
    examples: [
        {
            name: "Định's 5,000 transfer has no order code in its content: no-code, the judge decides",
            params: {},
            input: { evidenced: [...EVIDENCED_FOR_DINH] },
            output: { branch: "no-code", candidateIds: [], reasons: [] },
            effects: [],
        },
        {
            name: "the unrelated 2,000 MoMo transfer names no order either",
            params: {},
            input: { evidenced: [...EVIDENCED_FOR_MOMO] },
            output: { branch: "no-code", candidateIds: [], reasons: [] },
            effects: [],
        },
        {
            name: "a content that names SO-0001 with the amount due is matched at once",
            params: {},
            input: { evidenced: [...EVIDENCED_WITH_CODE] },
            output: { branch: "matched", candidateIds: ["order-dinh"], reasons: ["code_and_amount"] },
            effects: [],
        },
        {
            name: "a content that names SO-0001 but pays 4,000 of 5,000 is a mismatch for a person",
            params: {},
            input: { evidenced: [...EVIDENCED_CODE_WRONG_AMOUNT] },
            output: { branch: "mismatch", candidateIds: ["order-dinh"], reasons: ["code_amount_differs"] },
            effects: [],
        },
    ],
})
