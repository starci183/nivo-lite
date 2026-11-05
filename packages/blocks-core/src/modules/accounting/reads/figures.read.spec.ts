import type { ReadDefinition, ReadRunResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { INVOICE } from "../../../rules/accounting/accounting.fixtures"
import { bookEntryStore, invoiceStore, providerOf, questionCounter, transactionStore } from "../accounting.doubles"
import { bookEntriesPort, invoicesPort, questionsPort, transactionsPort } from "../ports"
import { closeCheckRead } from "./close-check.read"
import { OPEN_INVOICES_MAX, figuresRead } from "./figures.read"

const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-04T11:30:00.000Z") }

const NOT_RUNNABLE: ReadRunResult = { ok: false, problems: [] }

const run = (read: ReadDefinition, raw: unknown, unmatched: number, waiting: number): Promise<ReadRunResult> => {
    const provider = providerOf([
        [
            bookEntriesPort,
            bookEntryStore({
                totals: () =>
                    Promise.resolve([
                        { kind: "income", vnd: 5_000_000, count: 1 },
                        { kind: "invoice", vnd: 2_000_000, count: 1 },
                    ]),
            }),
        ],
        [
            transactionsPort,
            transactionStore({
                unmatchedIn: () => Promise.resolve({ vnd: unmatched * 300_000, count: unmatched }),
            }),
        ],
        [
            invoicesPort,
            invoiceStore({
                open: (limit) =>
                    Promise.resolve(
                        limit === OPEN_INVOICES_MAX
                            ? [
                                  {
                                      amountVnd: INVOICE.amountVnd,
                                      dueAt: INVOICE.dueAt,
                                      issuedAt: INVOICE.issuedAt,
                                      createdAt: INVOICE.createdAt,
                                  },
                              ]
                            : [],
                    ),
            }),
        ],
        [questionsPort, questionCounter({ waiting: () => Promise.resolve(waiting) })],
    ])
    return read.execute?.(provider, raw, CONTEXT) ?? Promise.resolve(NOT_RUNNABLE)
}

describe("accounting.figures", () => {
    it("adds up this month by default: entries by kind, unmatched payments and the open invoices", async () => {
        await expect(run(figuresRead, {}, 1, 0)).resolves.toMatchObject({
            ok: true,
            data: {
                periodKey: "this",
                fromDay: "2026-11-01",
                toDay: "2026-12-01",
                income: { vnd: 5_000_000, count: 1 },
                invoiced: { vnd: 2_000_000, count: 1 },
                adjustments: { vnd: 0, count: 0 },
                unmatched: { vnd: 300_000, count: 1 },
                receivable: { vnd: 2_000_000, count: 1 },
            },
        })
    })

    it("adds up last month when asked", async () => {
        await expect(run(figuresRead, { period: "last" }, 0, 0)).resolves.toMatchObject({
            ok: true,
            data: { periodKey: "last", fromDay: "2026-10-01", toDay: "2026-11-01" },
        })
    })

    it("refuses a period it does not know", async () => {
        await expect(run(figuresRead, { period: "next" }, 0, 0)).resolves.toMatchObject({ ok: false })
    })
})

describe("accounting.close-check", () => {
    it("checks last month by default and lists what stops it", async () => {
        await expect(run(closeCheckRead, {}, 2, 1)).resolves.toEqual({
            ok: true,
            data: {
                periodKey: "last",
                fromDay: "2026-10-01",
                toDay: "2026-11-01",
                canClose: false,
                blockers: ["unmatched_payments", "waiting_questions"],
            },
        })
    })

    it("lets last month close when nothing stops it, and keeps this month open", async () => {
        await expect(run(closeCheckRead, {}, 0, 0)).resolves.toMatchObject({
            ok: true,
            data: { canClose: true, blockers: [] },
        })
        await expect(run(closeCheckRead, { period: "this" }, 0, 0)).resolves.toMatchObject({
            ok: true,
            data: { canClose: false, blockers: ["period_open"] },
        })
    })
})
