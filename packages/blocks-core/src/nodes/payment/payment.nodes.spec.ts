import { fakeNodeContext, runNodeExamples } from "@nivo-lite/agent-sdk/testing"
import type { EffectVocabularyEntry } from "@nivo-lite/agent-sdk/testing"
import { z } from "zod"
import { coreNodes, paymentNodes } from ".."
import { paymentEvidenceNode } from "./evidence.node"
import { paymentJudgeNode } from "./judge.node"
import { paymentSettleNode } from "./settle.node"
import {
    ARRIVAL_DINH,
    CLAIM_OF_DINH,
    EVIDENCED_FOR_DINH,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_MOMO,
} from "./payment.fixtures"

/** The effects the host's vocabulary defines for these nodes (the payloads of the node contract). */
const EFFECTS: ReadonlyArray<EffectVocabularyEntry> = [
    {
        id: "payment.mark-paid",
        payload: z.object({ orderId: z.string(), transactionId: z.string(), evidence: z.array(z.string()) }),
    },
    { id: "channel.send", payload: z.object({ conversationId: z.string(), text: z.string() }) },
    {
        id: "work-item.raise",
        payload: z.object({
            action: z.string(),
            title: z.string(),
            payload: z.record(z.string(), z.unknown()),
            amountVnd: z.number().nullable().optional(),
        }),
    },
]

describe("the payment nodes", () => {
    it.each(paymentNodes.map((node) => [node.id, node] as const))("%s conforms to its examples", async (_id, node) => {
        await expect(runNodeExamples(node, EFFECTS)).resolves.toEqual([])
    })

    it("are listed among the core nodes with distinct kebab-case ids", () => {
        const ids = coreNodes.map((node) => node.id)
        expect(ids).toEqual([
            "payment.evidence",
            "payment.match-code",
            "payment.judge",
            "payment.settle",
            "payment.claim-wait",
        ])
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe("the real case end to end", () => {
    const grant = { rights: paymentNodes.flatMap((node) => node.rights) }
    const settleParams = { confirmationText: "Đã nhận {amount} đ cho {orderNo}", reviewTitle: "Kiểm tra" }

    it("matches the 5,000 transfer to Định's order when his claim came first, and leaves the 2,000 MoMo unmatched", async () => {
        const evidence = fakeNodeContext({ grant, store: STORE_REAL_CASE, params: { windowHours: 72 } })
        const dinh = await paymentEvidenceNode.run({ transactionId: TRANSACTION_DINH.id }, evidence)
        expect(dinh.arrival).toEqual(ARRIVAL_DINH)
        expect(dinh.claims).toEqual([CLAIM_OF_DINH])

        const judged = await paymentJudgeNode.run(
            { arrival: ARRIVAL_DINH, evidenced: [...dinh.evidenced], claims: [...dinh.claims] },
            fakeNodeContext({
                model: [{ verdict: "match", candidate_id: "order-dinh", reasons: ["khớp"] }],
            }),
        )
        expect(judged.branch).toBe("match")

        const settle = fakeNodeContext({ grant, store: STORE_REAL_CASE, params: settleParams })
        const settled = await paymentSettleNode.run(
            { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: [...judged.candidateIds], reasons: [...judged.reasons] },
            settle,
        )
        expect(settled).toEqual({ result: "paid", orderId: "order-dinh" })
        expect(settle.effects.map((one) => one.kind)).toEqual(["payment.mark-paid", "channel.send"])

        const momo = await paymentEvidenceNode.run({ transactionId: TRANSACTION_MOMO.id }, evidence)
        const ask = fakeNodeContext({})
        const left = await paymentJudgeNode.run(
            { arrival: momo.arrival ?? ARRIVAL_DINH, evidenced: [...momo.evidenced], claims: [...momo.claims] },
            ask,
        )
        expect(left.branch).toBe("no_match")
    })

    it("does not run past its rights: the evidence node cannot read without the grant", async () => {
        const context = fakeNodeContext({ store: STORE_REAL_CASE, params: { windowHours: 72 } })
        await expect(paymentEvidenceNode.run({ transactionId: TRANSACTION_DINH.id }, context)).rejects.toThrow()
    })

    it("keeps the evidence of the real case as the examples state it", () => {
        expect(EVIDENCED_FOR_DINH[0]?.evidence.filter((one) => one.met).map((one) => one.key)).toEqual([
            "amount",
            "name",
            "recency",
            "claim",
        ])
    })
})
