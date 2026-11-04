import type { NodeContext } from "@nivo-lite/agent-sdk/node"
import { accountingLedgerAppendNode } from "./ledger-append.node"
import { LEAD_DINH, ORDER_DINH, TRANSACTION_DINH } from "../payment/payment.fixtures"

// The worked examples run in the root conformance spec; these cover what an example cannot say: a tool that fails.

describe("accounting.ledger-append", () => {
    const run = async (failure: unknown) => {
        const raised: Array<[string, Record<string, unknown>, unknown]> = []
        const rows: Record<string, ReadonlyArray<unknown>> = {
            "bank-transaction": [TRANSACTION_DINH],
            order: [ORDER_DINH],
            "sales-lead": [LEAD_DINH],
        }
        const context = {
            params: { reconnectTitle: "reconnect" },
            data: { read: (kind: string) => Promise.resolve(rows[kind] ?? []) },
            tools: { call: () => Promise.reject(failure) },
            effect: (kind: string, payload: Record<string, unknown>, options: unknown) => {
                raised.push([kind, payload, options])
                return Promise.resolve({ kind, id: "x" })
            },
        } as unknown as NodeContext
        const outcome = await accountingLedgerAppendNode
            .run({ transactionId: TRANSACTION_DINH.id, orderId: ORDER_DINH.id, result: "paid" }, context as never)
            .then(
                () => "ran",
                (error: unknown) => error,
            )
        return { outcome, raised }
    }

    it("asks the owner once to reconnect when the provider refuses the connection, and lets the failure go on", async () => {
        const refusal = Object.assign(new Error("refused"), { code: "GRAPH_NODES_TOOL_CONNECTION_REFUSED" })

        const { outcome, raised } = await run(refusal)

        expect(outcome).toBe(refusal)
        expect(raised).toEqual([
            [
                "work-item.raise",
                { action: "connect_ledger", title: "reconnect", payload: { transactionId: TRANSACTION_DINH.id } },
                { dedupeKey: "ledger-reconnect" },
            ],
        ])
    })

    it("raises nothing for a failure the run can try again, and lets it go on", async () => {
        const transient = Object.assign(new Error("busy"), { code: "GRAPH_NODES_TOOL_FAILED" })

        const { outcome, raised } = await run(transient)

        expect(outcome).toBe(transient)
        expect(raised).toEqual([])
    })
})
