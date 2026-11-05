import {
    adjustmentStore,
    bookEntryStore,
    claimStore,
    conversationFinder,
    entriesSource,
    invoiceStore,
    leadNames,
    orderStore,
    providerOf,
    questionCounter,
    recordingOutbox,
    scriptedDoor,
    transactionStore,
} from "./accounting.doubles"
import { ordersPort, transactionsPort } from "./ports"

describe("accounting doubles", () => {
    it("rejects every method of a store until a spec answers it", async () => {
        const stores = [
            () => transactionStore().get("x"),
            () => orderStore().get("x"),
            () => claimStore().get("x"),
            () => invoiceStore().get("x"),
            () => adjustmentStore().get("x"),
            () => leadNames().nameOf("x"),
            () => conversationFinder().latestOfLead("x"),
            () => questionCounter().waiting(),
            () => bookEntryStore().get("x"),
            () =>
                entriesSource().counts(
                    { sort: { recent: [["id", "asc"]] }, page: { size: 1 }, row: { id: "id", title: "id" } },
                    "kind",
                    { q: null, filters: {}, sort: "recent", cursor: null, size: 1 },
                ),
        ]
        for (const call of stores) await expect(call()).rejects.toThrow("unused")
    })

    it("lets a spec answer a method", async () => {
        const store = orderStore({ get: () => Promise.resolve(null) })
        await expect(store.get("x")).resolves.toBeNull()
        await expect(store.setStatus("x", "1", "paid")).rejects.toThrow("unused")
    })

    it("records what an outbox is asked to enqueue", async () => {
        const { outbox, jobs } = recordingOutbox()
        await outbox.enqueue("accounting.book-project", { sourceId: "s" }, { dedupeKey: "k" })
        await outbox.enqueue("payment.confirm-notice", { orderId: "o" })
        expect(jobs).toEqual([
            { name: "accounting.book-project", input: { sourceId: "s" }, options: { dedupeKey: "k" } },
            { name: "payment.confirm-notice", input: { orderId: "o" }, options: undefined },
        ])
    })

    it("answers a door as scripted, calls to other tools being unknown, and records the calls", async () => {
        const { door, calls } = scriptedDoor({ "ledger.status": { ok: true, output: { connected: true } } })
        await expect(door.call("ledger.status", {})).resolves.toEqual({ ok: true, output: { connected: true } })
        await expect(door.call("chat.send", { text: "hi" })).resolves.toEqual({
            ok: false,
            reason: "unknown_tool",
            message: "chat.send",
        })
        expect(calls).toEqual([
            { tool: "ledger.status", input: {} },
            { tool: "chat.send", input: { text: "hi" } },
        ])
    })

    it("provides the implementation given for a port id, and nothing for another", () => {
        const orders = orderStore()
        const provider = providerOf([[ordersPort, orders]])
        expect(provider.implementationOf(ordersPort)).toBe(orders)
        expect(provider.implementationOf(transactionsPort)).toBeUndefined()
    })
})
