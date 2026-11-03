import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { runNode } from "@nivo-lite/agent-sdk/node"
import { coreEffects, coreNodes, paymentNodes } from "../.."
import {
    ARRIVAL_DINH,
    CLAIM_OF_DINH,
    EVIDENCED_FOR_DINH,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_MOMO,
} from "./payment.fixtures"

const SETTLE_PARAMS = { confirmationText: "Đã nhận {amount} đ cho {orderNo}", reviewTitle: "Kiểm tra" }

/** Runs one node as the host does, over fake ports: rights, declarations and payloads are enforced by the runner. */
const run = (node: NodeDefinition, params: unknown, input: unknown, options: FakeNodePortsOptions) => {
    const fake = fakeNodePorts(options)
    return runNode(
        {
            node,
            params,
            input,
            turn: EXAMPLE_TURN,
            grant: { rights: [...paymentNodes.flatMap((one) => one.rights), ...coreEffects.flatMap((effect) => effect.rights)] },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: `${node.id}:real-case`,
        },
        fake.ports,
    ).then((result) => ({ ...result, executed: fake.executed }))
}

const byId = (id: string): NodeDefinition => {
    const found = paymentNodes.find((node) => node.id === id)
    if (found === undefined) throw new Error(`no node ${id}`)
    return found
}

describe("the payment nodes", () => {
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

    it("keep conditions pure: the code rule and the judge run no effect", () => {
        expect(byId("payment.match-code").effects).toEqual([])
        expect(byId("payment.judge").effects).toEqual([])
    })
})

describe("the real case end to end", () => {
    it("matches the 5,000 transfer to Định's order when his claim came first, and leaves the 2,000 MoMo unmatched", async () => {
        const evidence = await run(byId("payment.evidence"), { windowHours: 72 }, { transactionId: TRANSACTION_DINH.id }, { store: STORE_REAL_CASE })
        expect(evidence.output).toMatchObject({ arrival: ARRIVAL_DINH, claims: [CLAIM_OF_DINH] })
        expect(evidence.output).toMatchObject({ evidenced: [...EVIDENCED_FOR_DINH] })

        const code = await run(byId("payment.match-code"), {}, { evidenced: EVIDENCED_FOR_DINH }, {})
        expect(code.output).toMatchObject({ branch: "no-code" })

        const judged = await run(
            byId("payment.judge"),
            {},
            { arrival: ARRIVAL_DINH, evidenced: EVIDENCED_FOR_DINH, claims: [CLAIM_OF_DINH] },
            { model: [{ verdict: "match", candidate_id: "order-dinh", reasons: ["khớp"] }] },
        )
        expect(judged.output).toMatchObject({ branch: "match", candidateIds: ["order-dinh"] })

        const settled = await run(
            byId("payment.settle"),
            SETTLE_PARAMS,
            { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: ["order-dinh"], reasons: ["khớp"], claimId: null },
            { store: STORE_REAL_CASE },
        )
        expect(settled.output).toEqual({ result: "paid", orderId: "order-dinh" })
        expect(settled.executed.map((one) => [one.id, one.dedupeKey])).toEqual([
            ["payment.mark-paid", `paid:${TRANSACTION_DINH.id}`],
            ["channel.send", "payment-confirmation:order-dinh"],
        ])

        const momo = await run(byId("payment.evidence"), { windowHours: 72 }, { transactionId: TRANSACTION_MOMO.id }, { store: STORE_REAL_CASE })
        const left = await run(byId("payment.judge"), {}, momo.output, {})
        expect(left.output).toMatchObject({ branch: "no_match", candidateIds: [] })
    })

    it("refuses an agent whose grant does not cover the evidence node's rights", async () => {
        const fake = fakeNodePorts({ store: STORE_REAL_CASE })
        await expect(
            runNode(
                {
                    node: byId("payment.evidence"),
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
