import { dayOf, entryOf, isConnectionRefused, isRecordable } from "./ledger.policy"
import type { LedgerResult } from "./ledger.policy"
import { sampleOf } from "../../messages/catalog"
import { ORDER_DINH, TRANSACTION_DINH, TRANSACTION_NAMED } from "../payment/payment.fixtures"

describe("ledger policy", () => {
    it("counts a paid or already-paid settlement as something to record, and nothing else", () => {
        const results: ReadonlyArray<LedgerResult> = ["paid", "already-paid", "raised", "voided"]
        expect(results.map((result) => isRecordable(result))).toEqual([true, true, false, false])
    })

    it("dates a payment by the shop's calendar day, seven hours ahead of UTC", () => {
        expect(dayOf("2026-11-04T01:06:00.000Z")).toBe("2026-11-04")
        expect(dayOf("2026-11-04T18:30:00.000Z")).toBe("2026-11-05")
    })

    it("names the customer by the lead, else the payer, else nobody", () => {
        expect(entryOf(TRANSACTION_DINH, ORDER_DINH, sampleOf("sampleBuiNguyenDinh"))).toEqual({
            date: "2026-11-04",
            orderNo: "SO-0001",
            customer: sampleOf("sampleBuiNguyenDinh"),
            amountVnd: 5000,
            transactionId: "tx-95958515",
            status: "paid",
            note: "",
        })
        expect(entryOf(TRANSACTION_NAMED, ORDER_DINH, null).customer).toBe("Nguyen Van A")
        expect(entryOf(TRANSACTION_DINH, ORDER_DINH, null).customer).toBe("")
    })

    it("knows the door's connection refusal by its code and nothing else", () => {
        expect(isConnectionRefused({ code: "GRAPH_NODES_TOOL_CONNECTION_REFUSED" })).toBe(true)
        expect(isConnectionRefused({ code: "GRAPH_NODES_TOOL_FAILED" })).toBe(false)
        expect(isConnectionRefused(new Error("x"))).toBe(false)
        expect(isConnectionRefused(null)).toBe(false)
    })
})
