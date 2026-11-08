import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { coreTools } from "../../vocabulary/tools"
import { BlocksError } from "../../blocks-error"
import { accountingPostPaymentNode } from "./post-payment.node"
import { LEAD_DINH, ORDER_DINH, TRANSACTION_DINH } from "../payment/payment.fixtures"
import { READ_LEADS, READ_ORDERS, READ_TRANSACTIONS } from "../payment/payment.rights"

// The worked examples run in the root conformance spec; these cover what an example cannot say: a tool that fails.

/** Runs the node on Dinh's payment with a ledger tool that fails with `failure`; answers what came out and the effects raised. */
const run = async (failure: BlocksError<string>) => {
    const fake = fakeNodePorts({
        store: { "bank-transaction": [TRANSACTION_DINH], order: [ORDER_DINH], "sales-lead": [LEAD_DINH] },
    })
    const outcome = await runNode(
        {
            node: accountingPostPaymentNode,
            params: { reconnectTitle: "reconnect" },
            input: { transactionId: TRANSACTION_DINH.id, orderId: ORDER_DINH.id, result: "paid" },
            turn: EXAMPLE_TURN,
            grant: { rights: [READ_TRANSACTIONS, READ_ORDERS, READ_LEADS], tools: ["ledger.append", "ledger.void"] },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(coreTools.map((tool) => [tool.id, tool])),
            key: "k",
        },
        { ...fake.ports, callTool: () => Promise.reject(failure) },
    ).then(
        () => "ran",
        (error: unknown) => error,
    )
    return { outcome, raised: fake.executed }
}

describe("accounting.post-payment", () => {
    it("asks the owner once to reconnect when the provider refuses the connection, and lets the failure go on", async () => {
        const refusal = new BlocksError("GRAPH_NODES_TOOL_CONNECTION_REFUSED", "ledger.append")

        const { outcome, raised } = await run(refusal)

        expect(outcome).toBe(refusal)
        expect(raised).toEqual([
            expect.objectContaining({
                id: "work-item.raise",
                payload: {
                    action: "connect_ledger",
                    title: "reconnect",
                    payload: { transactionId: TRANSACTION_DINH.id },
                },
                dedupeKey: "ledger-reconnect",
            }),
        ])
    })

    it("raises nothing for a failure the run can try again, and lets it go on", async () => {
        const transient = new BlocksError("GRAPH_NODES_TOOL_FAILED", "ledger.append")

        const { outcome, raised } = await run(transient)

        expect(outcome).toBe(transient)
        expect(raised).toEqual([])
    })
})
