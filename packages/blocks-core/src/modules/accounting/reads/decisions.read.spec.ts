import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { providerOf, transactionStore } from "../accounting.doubles"
import { UNMATCHED_PAYMENT } from "../fixtures/accounting.fixtures"
import type { UnmatchedList } from "../accounting.types"
import { transactionsPort, unmatchedListPort } from "../ports"
import { UNMATCHED_SHOWN, decisionsRead } from "./decisions.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

describe("the accounting.decisions read", () => {
    it("lists the payments of this month nobody tied to an invoice and counts all of them", async () => {
        const limits: Array<number> = []
        const unmatched: UnmatchedList = {
            waiting: (range, limit) => {
                limits.push(limit)
                expect(range.fromIso < range.toIso).toBe(true)
                return Promise.resolve([UNMATCHED_PAYMENT])
            },
        }
        const provider = providerOf([
            [transactionsPort, transactionStore({ unmatchedIn: () => Promise.resolve({ vnd: 900_000, count: 3 }) })],
            [unmatchedListPort, unmatched],
        ])
        const result = await decisionsRead.execute?.(provider, {}, CONTEXT)
        expect(limits).toEqual([UNMATCHED_SHOWN])
        expect(result).toMatchObject({
            ok: true,
            data: { count: "3", rows: [{ title: "Hoa Sen Spa", primary: null }] },
        })
    })

    it("is read with the view permission", () => {
        expect(decisionsRead.permission).toBe("accounting.view")
    })
})
