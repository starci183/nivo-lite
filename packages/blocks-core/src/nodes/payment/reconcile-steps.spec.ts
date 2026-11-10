import { isNodeConfused, runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition, NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { coreEffects, coreTools } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import { accountingMatchPaymentNode } from "../accounting/match-payment.node"
import { accountingPostPaymentNode } from "../accounting/post-payment.node"
import { ORDER_TEST, STORE_OVER, STORE_REAL_CASE, TRANSACTION_OVER } from "./payment.fixtures"
import { claimNamesOf } from "./payment.schemas"
import { paymentReceivedNoticeNode } from "./received-notice.node"
import { paymentSettleNode } from "./settle.node"

const STEPS: ReadonlyArray<NodeDefinition> = [
    accountingMatchPaymentNode,
    paymentSettleNode,
    accountingPostPaymentNode,
    paymentReceivedNoticeNode,
]

/** Runs one step as the host does, over fake ports, with every core effect and tool installed and granted. */
const runStep = (
    node: NodeDefinition,
    input: unknown,
    options: FakeNodePortsOptions,
    override: Partial<NodeHostPorts> = {},
) => {
    const fake = fakeNodePorts(options)
    return runNode(
        {
            node,
            params: {},
            input,
            turn: EXAMPLE_TURN,
            grant: {
                rights: [...node.rights, ...coreEffects.flatMap((effect) => effect.rights)],
                tools: coreTools.map((tool) => tool.id),
            },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(coreTools.map((tool) => [tool.id, tool])),
            key: `${node.id}:spec`,
        },
        { ...fake.ports, ...override },
    )
}

const causeOf = (ran: Promise<unknown>): Promise<unknown> =>
    ran.then(
        () => null,
        (thrown: unknown) => thrown,
    )

describe("the steps of Đối soát tiền về", () => {
    it.each(STEPS.flatMap((node) => node.examples.map((each) => [`${node.id} / ${each.name}`, node, each] as const)))(
        "example: %s",
        async (_name, node, each) => {
            await expect(nodeExampleMismatches(node, each, coreEffects, coreTools)).resolves.toEqual([])
        },
    )

    it("declare no failure branch and no work item: an agent that cannot finish is confused, the engine takes over", () => {
        for (const node of STEPS) expect(node.effects).not.toContain(TOOL.workItemRaise)
        expect(paymentSettleNode.requires).toEqual([TOOL.paymentMarkPaid])
        expect(accountingPostPaymentNode.requires).toEqual([TOOL.ledgerAppend])
        expect(paymentReceivedNoticeNode.requires).toEqual([TOOL.teamMessagePost])
    })
})

describe("accounting.match-payment", () => {
    it("never takes an order the agent named that is not among the records it was given", async () => {
        const done = {
            done: { transactionId: "tx-95958515", orderId: "order-ghost", claimId: null, settle: true, reason: "x" },
        }
        const cause = await causeOf(
            runStep(
                accountingMatchPaymentNode,
                { transactionId: "tx-95958515" },
                { store: STORE_REAL_CASE, model: [done] },
            ),
        )
        expect(String(cause)).toContain("MATCH_PAYMENT_UNKNOWN_ORDER")
    })

    it("hands the agent's confusion to the engine", async () => {
        const confused = { confused: { reason: "Hai đơn cùng số tiền", question: "Khoản này của đơn nào?" } }
        const cause = await causeOf(
            runStep(
                accountingMatchPaymentNode,
                { transactionId: "tx-95958515" },
                { store: STORE_REAL_CASE, model: [confused] },
            ),
        )
        expect(isNodeConfused(cause)).toBe(true)
    })

    it("reads the numbers of the owner's 2,000-for-1,000 test from the records, whatever the agent thinks", async () => {
        const done = {
            done: { transactionId: "tx-over", orderId: "order-test", claimId: null, settle: true, reason: "x" },
        }
        await expect(
            runStep(accountingMatchPaymentNode, { transactionId: "tx-over" }, { store: STORE_OVER, model: [done] }),
        ).resolves.toMatchObject({
            output: { verdict: "over", expectedVnd: 1000, receivedVnd: 2000 },
        })
    })

    it("ends a second run for a credit that already paid an order: no agent turn, no question to the founder, no freeze", async () => {
        const settled = { ...TRANSACTION_OVER, orderId: "order-test", status: "matched" }
        const store = { ...STORE_OVER, "bank-transaction": [settled], order: [{ ...ORDER_TEST, status: "paid" }] }
        // No model turn is scripted: a call to the agent would fail the run.
        const ran = await runStep(accountingMatchPaymentNode, { transactionId: "tx-over" }, { store, model: [] })
        expect(ran).toMatchObject({
            output: {
                branch: "held",
                transactionId: "tx-over",
                orderId: "order-test",
                settle: false,
                reason: "transaction_settled",
            },
        })
        expect(ran.effects).toEqual([])
    })

    it("does not ask the founder again about a credit the first run asked about and the founder then settled", async () => {
        const first = await runStep(
            accountingMatchPaymentNode,
            { transactionId: "tx-over" },
            {
                store: STORE_OVER,
                model: [
                    { done: { transactionId: "tx-over", orderId: null, claimId: null, settle: false, reason: "x" } },
                ],
            },
        )
        expect(first).toMatchObject({ output: { branch: "unmatched" } })
        const settled = { ...TRANSACTION_OVER, orderId: "order-test", status: "matched" }
        const second = await runStep(
            accountingMatchPaymentNode,
            { transactionId: "tx-over" },
            { store: { ...STORE_OVER, "bank-transaction": [settled] }, model: [] },
        )
        expect(second).toMatchObject({ output: { branch: "held", reason: "transaction_settled" } })
        expect(second.effects).toEqual([])
    })

    it("routes money that pays no open order as unmatched, never to mark paid", async () => {
        const done = { done: { transactionId: "tx-over", orderId: null, claimId: null, settle: false, reason: "x" } }
        await expect(
            runStep(accountingMatchPaymentNode, { transactionId: "tx-over" }, { store: STORE_OVER, model: [done] }),
        ).resolves.toMatchObject({
            output: { branch: "unmatched", orderId: null, receivedVnd: 2000 },
        })
    })

    it("holds the order's money the agent does not settle now (a short payment the founder keeps open)", async () => {
        const done = {
            done: { transactionId: "tx-over", orderId: "order-test", claimId: null, settle: false, reason: "x" },
        }
        await expect(
            runStep(accountingMatchPaymentNode, { transactionId: "tx-over" }, { store: STORE_OVER, model: [done] }),
        ).resolves.toMatchObject({
            output: { branch: "held", orderId: "order-test" },
        })
    })
})

describe("payment.settle", () => {
    it("cannot finish when the guard refuses a used transaction: the refusal is a fact and the agent is confused", async () => {
        const refused = {
            kind: "refused",
            id: "transaction_used",
            facts: { orderAmountVnd: 1000, receivedVnd: 2000, paidOrderId: "order-other" },
        }
        const pay = { call: { tool: TOOL.paymentMarkPaid, args: { orderId: "order-test", transactionId: "tx-over" } } }
        const cause = await causeOf(
            runStep(
                paymentSettleNode,
                { orderId: "order-test", transactionId: "tx-over" },
                {
                    store: STORE_OVER,
                    model: [
                        pay,
                        { done: { result: "paid" } },
                        {
                            confused: {
                                reason: "Giao dịch đã trả cho đơn khác",
                                question: "Giao dịch này thuộc đơn nào?",
                            },
                        },
                    ],
                },
                { execute: () => Promise.resolve(refused) },
            ),
        )
        expect(isNodeConfused(cause)).toBe(true)
    })
})

describe("claimNamesOf", () => {
    it("reads the names a claim stores as { values } or as a plain list, and nothing else", () => {
        expect(claimNamesOf({ values: ["DINH"] })).toEqual(["DINH"])
        expect(claimNamesOf(["DINH"])).toEqual(["DINH"])
        expect(claimNamesOf({ values: [] })).toEqual([])
        expect(claimNamesOf({})).toEqual([])
        expect(claimNamesOf(null)).toEqual([])
    })
})
