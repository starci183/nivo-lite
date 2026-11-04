import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { runNode } from "@nivo-lite/agent-sdk/node"
import { coreEffects, coreNodes, paymentNodes } from "../.."
import { paymentEvidenceNode } from "./evidence.node"
import { paymentJudgeNode } from "./judge.node"
import { paymentMatchCodeNode } from "./match-code.node"
import { paymentSettleNode } from "./settle.node"
import {
    ARRIVAL_DINH,
    CLAIM_DINH,
    CLAIM_OF_DINH,
    EVIDENCED_FOR_DINH,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_MOMO,
} from "./payment.fixtures"
import { sampleOf } from "../../messages/catalog"

const SETTLE_PARAMS = {
    confirmationText: sampleOf("sampleDaNhanAmountDChoOrderno"),
    reviewTitle: sampleOf("sampleKiemTra"),
}

/** Runs one node as the host does, over fake ports: rights, declarations and payloads are enforced by the runner. */
const run = (node: NodeDefinition, params: unknown, input: unknown, options: FakeNodePortsOptions) => {
    const fake = fakeNodePorts(options)
    return runNode(
        {
            node,
            params,
            input,
            turn: EXAMPLE_TURN,
            grant: {
                rights: [
                    ...paymentNodes.flatMap((one) => one.rights),
                    ...coreEffects.flatMap((effect) => effect.rights),
                ],
            },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: `${node.id}:real-case`,
        },
        fake.ports,
    ).then((result) => ({ ...result, executed: fake.executed }))
}

describe("the payment nodes", () => {
    it("are listed among the core nodes with distinct kebab-case ids", () => {
        const ids = coreNodes.map((node) => node.id)
        expect(ids).toEqual(
            expect.arrayContaining([
                "payment.evidence",
                "payment.match-code",
                "payment.judge",
                "payment.settle",
                "payment.claim-wait",
            ]),
        )
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("keep conditions pure: the code rule and the judge run no effect", () => {
        expect(paymentMatchCodeNode.effects).toEqual([])
        expect(paymentJudgeNode.effects).toEqual([])
    })
})

describe("a claim of a customer with no lead yet", () => {
    it("is evidence keyed by its conversation, so it never counts as the party of an order", async () => {
        const claim = { ...CLAIM_DINH, leadId: null }
        const store = { ...STORE_REAL_CASE, "payment-claim": [claim] }

        const evidence = await run(
            paymentEvidenceNode,
            { windowHours: 72 },
            { transactionId: TRANSACTION_DINH.id },
            { store },
        )

        expect(evidence.output).toMatchObject({
            claims: [{ id: claim.id, partyKey: "conversation:conversation-dinh" }],
        })
    })

    it("falls back to the claim itself when it has no conversation either", async () => {
        const claim = { ...CLAIM_DINH, leadId: null, conversationId: null }
        const store = { ...STORE_REAL_CASE, "payment-claim": [claim] }

        const evidence = await run(
            paymentEvidenceNode,
            { windowHours: 72 },
            { transactionId: TRANSACTION_DINH.id },
            { store },
        )

        expect(evidence.output).toMatchObject({ claims: [{ partyKey: "conversation:claim-dinh" }] })
    })
})

describe("the real case end to end", () => {
    it("matches the 5,000 transfer to Dinh's order when his claim came first, and leaves the 2,000 MoMo unmatched", async () => {
        const evidence = await run(
            paymentEvidenceNode,
            { windowHours: 72 },
            { transactionId: TRANSACTION_DINH.id },
            { store: STORE_REAL_CASE },
        )
        expect(evidence.output).toMatchObject({ arrival: ARRIVAL_DINH, claims: [CLAIM_OF_DINH] })
        expect(evidence.output).toMatchObject({ evidenced: [...EVIDENCED_FOR_DINH] })

        const code = await run(paymentMatchCodeNode, {}, { evidenced: EVIDENCED_FOR_DINH }, {})
        expect(code.output).toMatchObject({ branch: "no-code" })

        const judged = await run(
            paymentJudgeNode,
            {},
            { arrival: ARRIVAL_DINH, evidenced: EVIDENCED_FOR_DINH, claims: [CLAIM_OF_DINH] },
            { model: [{ verdict: "match", candidate_id: "order-dinh", reasons: [sampleOf("sampleKhop")] }] },
        )
        expect(judged.output).toMatchObject({ branch: "match", candidateIds: ["order-dinh"] })

        const settled = await run(
            paymentSettleNode,
            SETTLE_PARAMS,
            {
                transactionId: TRANSACTION_DINH.id,
                mode: "apply",
                candidateIds: ["order-dinh"],
                reasons: [sampleOf("sampleKhop")],
                claimId: null,
            },
            { store: STORE_REAL_CASE },
        )
        expect(settled.output).toEqual({ result: "paid", orderId: "order-dinh" })
        expect(settled.executed.map((one) => [one.id, one.dedupeKey])).toEqual([
            ["payment.mark-paid", `paid:${TRANSACTION_DINH.id}`],
            ["channel.send", "payment-confirmation:order-dinh"],
        ])

        const momo = await run(
            paymentEvidenceNode,
            { windowHours: 72 },
            { transactionId: TRANSACTION_MOMO.id },
            { store: STORE_REAL_CASE },
        )
        const left = await run(paymentJudgeNode, {}, momo.output, {})
        expect(left.output).toMatchObject({ branch: "no_match", candidateIds: [] })
    })

    it("refuses an agent whose grant does not cover the evidence node's rights", async () => {
        const fake = fakeNodePorts({ store: STORE_REAL_CASE })
        await expect(
            runNode(
                {
                    node: paymentEvidenceNode,
                    params: { windowHours: 72 },
                    input: { transactionId: TRANSACTION_DINH.id },
                    turn: EXAMPLE_TURN,
                    grant: { rights: [] },
                    effects: new Map(),
                    tools: new Map(),
                    key: "denied",
                },
                fake.ports,
            ),
        ).rejects.toThrow()
    })
})
