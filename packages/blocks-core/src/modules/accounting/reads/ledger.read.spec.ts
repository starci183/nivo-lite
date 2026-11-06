import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { bookEntryStore, providerOf } from "../accounting.doubles"
import type { DayRange } from "../accounting.types"
import { CASH_ENTRIES } from "../fixtures/accounting.fixtures"
import { bookEntriesPort } from "../ports"
import { ledgerRead } from "./ledger.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const run = async (raw: unknown) => {
    const ranges: Array<DayRange> = []
    const provider = providerOf([
        [
            bookEntriesPort,
            bookEntryStore({
                totals: (range) => {
                    ranges.push(range)
                    return Promise.resolve([{ kind: "income", vnd: 12_000_000, count: 3 }])
                },
                cash: (range) => {
                    ranges.push(range)
                    return Promise.resolve(CASH_ENTRIES)
                },
            }),
        ],
    ])
    return { ranges, result: await ledgerRead.execute?.(provider, raw, CONTEXT) }
}

describe("the accounting.ledger read", () => {
    it("opens with everything before the period and lists the entries of the period by day", async () => {
        const { ranges, result } = await run({})
        expect(ranges).toEqual([
            { fromDay: "1970-01-01", toDay: "2026-11-01" },
            expect.objectContaining({ fromDay: "2026-11-01", toDay: "2026-12-01" }),
        ])
        expect(result).toMatchObject({
            ok: true,
            data: {
                periodKey: "this",
                openingVnd: 12_000_000,
                inVnd: 5_450_000,
                outVnd: 1_280_000,
                closingVnd: 16_170_000,
            },
        })
    })

    it("asks for last month when told to, and is read with the view permission", async () => {
        const { ranges } = await run({ period: "last" })
        expect(ranges[0]?.toDay).toBe("2026-10-01")
        expect(ledgerRead.permission).toBe("accounting.view")
    })
})
