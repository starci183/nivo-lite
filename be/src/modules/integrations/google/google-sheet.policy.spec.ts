import { mock } from "@starci/jest-preset"
import { GoogleErrorCode } from "./errors/google.error"
import type { SheetConfig, SheetEventIn, SheetsApi } from "./google.contracts"
import {
    applySheetEvent,
    buildCreateBody,
    buildFormatBody,
    formatVnTime,
    formatVnd,
    leadHeader,
    leadKey,
    leadsTab,
    orderHeader,
    ordersTab,
    sheetText,
} from "./google-sheet.policy"

const NOW = new Date("2026-10-12T03:00:00.000Z")
const ALL_ON: SheetConfig = { spreadsheetId: "sheet-1", recordLeads: true, markPaid: "true", recordOrders: true }
const LEAD_ID = "11111111-2222-3333-4444-555555555555"

const eventOf = (event: SheetEventIn["event"], data: Record<string, unknown>): SheetEventIn => ({
    event,
    data,
    occurredAt: "2026-10-12T03:00:00.000Z",
})

const apiOf = (found: { row: number; code: string } | null = null) => {
    const api = mock<SheetsApi>()
    api.findRow.mockResolvedValue(found)
    api.appendRow.mockResolvedValue(7)
    api.updateCells.mockResolvedValue(undefined)
    return api
}

describe("sheet copy", () => {
    it("reads the Vietnamese product text and fills placeholders", () => {
        expect(sheetText("sheet.paidNote", { amount: "1", at: "2" })).toContain("1")
        expect(sheetText("evidence.skipped")).toBe("B\u1ecf qua \u00b7 ")
        expect(sheetText("no.such.key")).toBe("no.such.key")
    })

    it("lists the tabs and the header rows", () => {
        expect(ordersTab()).toBe("\u0110\u01a1n h\u00e0ng")
        expect(leadsTab()).toBe("Kh\u00e1ch m\u1edbi")
        expect(orderHeader()).toHaveLength(9)
        expect(leadHeader()).toHaveLength(7)
    })
})

describe("formatting", () => {
    it("formats Vietnam time and falls back to now for a bad instant", () => {
        expect(formatVnTime("2026-10-12T03:00:00.000Z", NOW)).toBe("12/10/2026 10:00")
        expect(formatVnTime("not a date", NOW)).toBe("12/10/2026 10:00")
    })

    it("formats dong and lead keys", () => {
        expect(formatVnd(1234567.4)).toBe("1.234.567 \u20ab")
        expect(leadKey(LEAD_ID)).toBe("KH-11111111")
    })
})

describe("spreadsheet bodies", () => {
    it("builds the two tabs with frozen headers and the sample row", () => {
        const body = buildCreateBody("Shop", NOW)
        expect(body.properties.title).toBe("Shop")
        expect(body.sheets.map((sheet) => sheet.properties.title)).toEqual([ordersTab(), leadsTab()])
        expect(body.sheets[0]?.data[0]?.rowData[1]?.values).toHaveLength(9)
        expect(body.sheets[0]?.data[0]?.rowData[0]?.values[0]).toHaveProperty("userEnteredFormat.textFormat.bold", true)
        expect(body.sheets[0]?.data[0]?.rowData[1]?.values[4]).toEqual({ userEnteredValue: { numberValue: 500000 } })
    })

    it("formats the money column", () => {
        expect(buildFormatBody().requests[0]?.repeatCell.range.startColumnIndex).toBe(4)
    })
})

describe("applySheetEvent", () => {
    it("refuses an event with no spreadsheet", async () => {
        await expect(applySheetEvent(apiOf(), {}, eventOf("lead.created", {}), NOW)).rejects.toMatchObject({
            code: GoogleErrorCode.SheetMissing,
        })
    })

    it("records a new customer on the leads tab", async () => {
        const api = apiOf()
        const result = await applySheetEvent(
            api,
            ALL_ON,
            eventOf("lead.created", { name: "An", company: "C", need: "N", phone: "0", email: "e", channel: "tg" }),
            NOW,
        )

        expect(api.appendRow).toHaveBeenCalledWith("sheet-1", leadsTab(), 7, [
            "12/10/2026 10:00",
            "An",
            "C",
            "N",
            "0",
            "e",
            "tg",
        ])
        expect(result.evidence).toContain("An")
    })

    it("names an anonymous new customer and skips the leads tab when it is off", async () => {
        const api = apiOf()
        const anonymous = await applySheetEvent(api, ALL_ON, eventOf("lead.created", {}), NOW)
        const off = await applySheetEvent(api, { spreadsheetId: "s" }, eventOf("lead.created", {}), NOW)

        expect(anonymous.evidence).toContain(sheetText("evidence.noName"))
        expect(off.skipped).toBe(true)
        expect(api.appendRow).toHaveBeenCalledTimes(1)
    })

    it("skips payments and orders when their switches are off", async () => {
        const api = apiOf()
        const paid = await applySheetEvent(api, { spreadsheetId: "s" }, eventOf("payment.received", {}), NOW)
        const order = await applySheetEvent(api, { spreadsheetId: "s" }, eventOf("order.confirmed", {}), NOW)

        expect(paid.skipped).toBe(true)
        expect(order.skipped).toBe(true)
        expect(api.findRow).not.toHaveBeenCalled()
    })

    it("marks the matching row paid", async () => {
        const api = apiOf({ row: 4, code: "DH-1" })
        const result = await applySheetEvent(
            api,
            ALL_ON,
            eventOf("payment.received", { order_no: "DH-1", amount_vnd: 5000, paid_at: "2026-10-12T04:00:00.000Z" }),
            NOW,
        )

        expect(api.findRow).toHaveBeenCalledWith("sheet-1", ["DH-1", ""])
        expect(api.updateCells).toHaveBeenCalledWith("sheet-1", 4, {
            F: sheetText("sheet.statusPaid"),
            G: sheetText("sheet.paidNote", { amount: formatVnd(5000), at: "12/10/2026 11:00" }),
        })
        expect(result.evidence).toContain("DH-1")
    })

    it("adds a paid row when no row matches, keyed by order, invoice or lead", async () => {
        const api = apiOf()
        await applySheetEvent(api, ALL_ON, eventOf("payment.received", { order_no: "DH-2", amount_vnd: "9" }), NOW)
        await applySheetEvent(api, ALL_ON, eventOf("payment.received", { invoice_no: 3 }), NOW)
        await applySheetEvent(api, ALL_ON, eventOf("payment.received", { lead_id: LEAD_ID, customer: "B" }), NOW)

        const codes = api.appendRow.mock.calls.map((call) => call[3]?.[1])
        expect(codes).toEqual(["DH-2", "3", "KH-11111111"])
    })

    it("keeps the row of a won deal that already exists and appends a new one otherwise", async () => {
        const kept = await applySheetEvent(
            apiOf({ row: 3, code: "KH-1" }),
            ALL_ON,
            eventOf("deal.won", { lead_id: LEAD_ID }),
            NOW,
        )
        const api = apiOf()
        const added = await applySheetEvent(api, ALL_ON, eventOf("deal.won", { lead_id: LEAD_ID, company: "Co" }), NOW)
        await applySheetEvent(api, ALL_ON, eventOf("deal.won", { lead_id: LEAD_ID, name: "Nm" }), NOW)

        expect(kept.evidence).toContain("KH-1")
        expect(added.evidence).toContain("KH-11111111")
        expect(api.appendRow.mock.calls.map((call) => call[3]?.[2])).toEqual(["Co", "Nm"])
    })

    it("leaves an existing order row alone when it already has the order code or there is none", async () => {
        const same = await applySheetEvent(
            apiOf({ row: 2, code: "DH-1" }),
            ALL_ON,
            eventOf("order.confirmed", { order_no: "DH-1" }),
            NOW,
        )
        const noOrder = await applySheetEvent(
            apiOf({ row: 2, code: "KH-1" }),
            ALL_ON,
            eventOf("order.confirmed", { lead_id: LEAD_ID }),
            NOW,
        )

        expect(same.evidence).toContain("DH-1")
        expect(noOrder.evidence).toContain("KH-1")
    })

    it("turns the row of a won deal into the order row", async () => {
        const api = apiOf({ row: 5, code: "KH-1" })
        await applySheetEvent(
            api,
            ALL_ON,
            eventOf("order.confirmed", {
                order_no: "DH-9",
                lead_id: LEAD_ID,
                items: ["A", { name: "B" }, { title: "C" }, null, 7],
                amount_vnd: 100,
                confirmed_by: "Owner",
            }),
            NOW,
        )
        await applySheetEvent(
            api,
            ALL_ON,
            eventOf("order.confirmed", { order_no: "DH-9", lead_id: LEAD_ID, items: "Text", amount_vnd: "x" }),
            NOW,
        )

        expect(api.updateCells).toHaveBeenNthCalledWith(1, "sheet-1", 5, {
            B: "DH-9",
            D: "A, B, C",
            E: 100,
            F: sheetText("sheet.statusWon"),
            I: "Owner",
        })
        expect(api.updateCells).toHaveBeenNthCalledWith(2, "sheet-1", 5, {
            B: "DH-9",
            D: "Text",
            E: 0,
            F: sheetText("sheet.statusWon"),
        })
    })

    it("appends a confirmed order that has no row yet", async () => {
        const api = apiOf()
        const result = await applySheetEvent(
            api,
            ALL_ON,
            eventOf("order.confirmed", {
                order_no: "DH-5",
                customer: "K",
                items: ["X"],
                amount_vnd: 10,
                channel: "zalo",
                confirmed_by: "O",
            }),
            NOW,
        )

        expect(api.appendRow).toHaveBeenCalledWith("sheet-1", ordersTab(), 9, [
            "12/10/2026 10:00",
            "DH-5",
            "K",
            "X",
            10,
            sheetText("sheet.statusWon"),
            "",
            "zalo",
            "O",
        ])
        expect(result.evidence).toContain("DH-5")
    })
})
