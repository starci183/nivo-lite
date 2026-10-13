import {
    BATCH,
    NO_SCAN,
    contractWindow,
    debtCutoffIso,
    lookbackIso,
    planContractScan,
    planDailyReport,
    planDebtScan,
    planLeadScan,
    planN8nSchedule,
    previousMonth,
    priorRunsOf,
} from "./scan.policy"
import type { PriorRuns } from "./scan.policy"

const NOW = new Date("2026-10-12T10:00:00.000Z")
const HOUR = 3_600_000
const DAY = 86_400_000

const prior = (rows: Array<{ ref: string; status: string; at: string; dedupe: string }> = []): PriorRuns =>
    priorRunsOf(
        rows.map((row) => ({
            trigger_ref: row.ref,
            status: row.status,
            created_at: row.at,
            dedupe_key: row.dedupe,
        })),
    )

describe("priorRunsOf", () => {
    it("groups the real runs per reference and remembers every dedupe key", () => {
        const history = prior([
            { ref: "a", status: "done", at: "2026-10-10T00:00:00.000Z", dedupe: "k1" },
            { ref: "a", status: "waiting_approval", at: "2026-10-11T00:00:00.000Z", dedupe: "k2" },
            { ref: "a", status: "done", at: "2026-10-09T00:00:00.000Z", dedupe: "k0" },
            { ref: "a", status: "skipped", at: "2026-10-12T00:00:00.000Z", dedupe: "k3" },
            { ref: "b", status: "failed", at: "2026-10-12T00:00:00.000Z", dedupe: "k4" },
        ])

        expect(history.seen.get("a")).toEqual({ n: 3, last: Date.parse("2026-10-11T00:00:00.000Z"), waiting: true })
        expect(history.seen.has("b")).toBe(false)
        expect([...history.used].sort()).toEqual(["k0", "k1", "k2", "k3", "k4"])
    })
})

describe("lookbackIso", () => {
    it("reaches back 30 days for a nurture scan and a year for a win back scan", () => {
        expect(lookbackIso(NOW, "nurture")).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString())
        expect(lookbackIso(NOW, "win_back")).toBe(new Date(NOW.getTime() - 365 * DAY).toISOString())
    })
})

describe("planLeadScan", () => {
    const leads = ["l-1", "l-2", "l-3"].map((id) => ({ id, stage: "new", createdAt: "2026-10-01T00:00:00.000Z" }))
    const quiet = new Map(leads.map((lead) => [lead.id, NOW.getTime() - 48 * HOUR]))
    const all = new Set(leads.map((lead) => lead.id))

    it("nudges a quiet lead with a chat, numbering the nudges", () => {
        const plans = planLeadScan(
            "nurture",
            leads.slice(0, 1),
            quiet,
            all,
            prior(),
            { afterHours: 24, maxFollowUps: 3 },
            NOW,
            BATCH,
        )

        expect(plans).toEqual([
            { dedupe: "nurture:l-1:1", triggerRef: "l-1", payload: { lead_id: "l-1", k: 1, dedupe: "nurture:l-1:1" } },
        ])
    })

    it("skips a lead without a chat, a lead that is not quiet yet and one without any activity record", () => {
        const config = { afterHours: 24, maxFollowUps: 3 }
        const recent = new Map([["l-1", NOW.getTime() - HOUR]])

        expect(
            planLeadScan("nurture", leads, quiet, new Set(["l-2"]), prior(), config, NOW, BATCH).map(
                (p) => p.triggerRef,
            ),
        ).toEqual(["l-2"])
        expect(planLeadScan("nurture", leads.slice(0, 1), recent, all, prior(), config, NOW, BATCH)).toEqual([])
        expect(planLeadScan("nurture", leads.slice(0, 1), new Map(), all, prior(), config, NOW, BATCH)).toHaveLength(1)
    })

    it("waits for an open run, for the quiet period after a run, and stops after the most nudges", () => {
        const config = { afterHours: 24, maxFollowUps: 1 }
        const waiting = prior([{ ref: "l-1", status: "waiting_approval", at: "2026-10-01T00:00:00.000Z", dedupe: "x" }])
        const justSent = prior([
            { ref: "l-1", status: "done", at: new Date(NOW.getTime() - HOUR).toISOString(), dedupe: "y" },
        ])
        const exhausted = prior([{ ref: "l-1", status: "done", at: "2026-10-01T00:00:00.000Z", dedupe: "z" }])
        const used = prior([
            { ref: "other", status: "skipped", at: "2026-10-01T00:00:00.000Z", dedupe: "nurture:l-1:1" },
        ])

        for (const history of [waiting, justSent, exhausted, used]) {
            expect(planLeadScan("nurture", leads.slice(0, 1), quiet, all, history, config, NOW, BATCH)).toEqual([])
        }
    })

    it("invites a lead back once a month and never twice", () => {
        const config = { afterDays: 2 }
        const plans = planLeadScan("win_back", leads.slice(0, 1), quiet, all, prior(), config, NOW, BATCH)
        const done = prior([
            { ref: "l-1", status: "done", at: "2026-01-01T00:00:00.000Z", dedupe: "winback:l-1:2026-01" },
        ])
        const sameMonth = prior([
            { ref: "x", status: "skipped", at: "2026-10-01T00:00:00.000Z", dedupe: "winback:l-1:2026-10" },
        ])

        expect(plans).toEqual([
            {
                dedupe: "winback:l-1:2026-10",
                triggerRef: "l-1",
                payload: { lead_id: "l-1", dedupe: "winback:l-1:2026-10" },
            },
        ])
        expect(planLeadScan("win_back", leads.slice(0, 1), quiet, all, done, config, NOW, BATCH)).toEqual([])
        expect(planLeadScan("win_back", leads.slice(0, 1), quiet, all, sameMonth, config, NOW, BATCH)).toEqual([])
    })

    it("starts at most a batch", () => {
        expect(
            planLeadScan("nurture", leads, quiet, all, prior(), { afterHours: 24, maxFollowUps: 3 }, NOW, 2),
        ).toHaveLength(2)
    })
})

describe("debt scan", () => {
    const invoice = (id: string, leadId: string | null) => ({
        id,
        invoiceNo: `HD-${id}`,
        amountVnd: 1000,
        leadId,
        dueAt: "2026-09-01T00:00:00.000Z",
    })
    const config = { afterDays: 3 }

    it("finds the cutoff of an overdue invoice", () => {
        expect(debtCutoffIso(NOW, config)).toBe(new Date(NOW.getTime() - 3 * DAY).toISOString())
    })

    it("reminds a customer with a chat and numbers the reminders", () => {
        const plans = planDebtScan([invoice("i-1", "l-1")], new Set(["l-1"]), prior(), config, NOW, BATCH)

        expect(plans).toEqual([
            {
                dedupe: "debt:i-1:1",
                triggerRef: "i-1",
                payload: {
                    invoice_id: "i-1",
                    invoice_no: "HD-i-1",
                    amount_vnd: 1000,
                    lead_id: "l-1",
                    k: 1,
                    dedupe: "debt:i-1:1",
                },
            },
        ])
    })

    it("skips an invoice with no customer or no chat", () => {
        const invoices = [invoice("i-1", null), invoice("i-2", "l-2"), invoice("i-3", "l-3")]

        expect(planDebtScan(invoices, new Set(["l-3"]), prior(), config, NOW, BATCH).map((p) => p.triggerRef)).toEqual([
            "i-3",
        ])
    })

    it("waits for an open reminder, stops after two, keeps the gap between reminders and never repeats a key", () => {
        const chat = new Set(["l-1"])
        const one = [invoice("i-1", "l-1")]
        const open = prior([{ ref: "i-1", status: "waiting_approval", at: "2026-10-01T00:00:00.000Z", dedupe: "a" }])
        const two = prior([
            { ref: "i-1", status: "done", at: "2026-10-01T00:00:00.000Z", dedupe: "b" },
            { ref: "i-1", status: "done", at: "2026-10-02T00:00:00.000Z", dedupe: "c" },
        ])
        const recent = prior([
            { ref: "i-1", status: "done", at: new Date(NOW.getTime() - DAY).toISOString(), dedupe: "d" },
        ])
        const old = prior([{ ref: "i-1", status: "done", at: "2026-10-01T00:00:00.000Z", dedupe: "e" }])
        const reused = prior([{ ref: "z", status: "skipped", at: "2026-10-01T00:00:00.000Z", dedupe: "debt:i-1:1" }])

        expect(planDebtScan(one, chat, open, config, NOW, BATCH)).toEqual([])
        expect(planDebtScan(one, chat, two, config, NOW, BATCH)).toEqual([])
        expect(planDebtScan(one, chat, recent, config, NOW, BATCH)).toEqual([])
        expect(planDebtScan(one, chat, old, config, NOW, BATCH)[0]?.dedupe).toBe("debt:i-1:2")
        expect(planDebtScan(one, chat, reused, config, NOW, BATCH)).toEqual([])
    })

    it("starts at most a batch", () => {
        const invoices = [invoice("i-1", "l-1"), invoice("i-2", "l-1"), invoice("i-3", "l-1")]

        expect(planDebtScan(invoices, new Set(["l-1"]), prior(), config, NOW, 2)).toHaveLength(2)
    })
})

describe("planDailyReport", () => {
    it("is due once the configured time of the Vietnam day has passed", () => {
        expect(planDailyReport({ time: "08:00" }, NOW)).toEqual({
            dedupe: "daily:2026-10-12",
            triggerRef: "2026-10-12",
            payload: { day: "2026-10-12" },
        })
        expect(planDailyReport({ time: "20:00" }, NOW)).toBeNull()
    })
})

describe("contract scan", () => {
    it("covers from today until the days ahead the settings name, 14 by default and 90 at most", () => {
        expect(contractWindow(NOW, { beforeDays: 30 })).toEqual({ today: "2026-10-12", horizon: "2026-11-11" })
        expect(contractWindow(NOW, {})).toEqual({ today: "2026-10-12", horizon: "2026-10-26" })
        expect(contractWindow(NOW, { beforeDays: 500 }).horizon).toBe("2027-01-10")
        expect(contractWindow(NOW, { beforeDays: -4 }).horizon).toBe("2026-10-13")
    })

    it("announces the expiring contracts that were not announced for their current end date", () => {
        const contracts = [
            { id: "c-1", endsOn: "2026-10-20" },
            { id: "c-2", endsOn: "2026-10-30" },
            { id: "c-3", endsOn: "2026-11-02" },
        ]
        const used = new Set(["renew:contract.expiring:c-2:2026-10-30"])

        expect(planContractScan(contracts, used, "2026-10-12", 5)).toEqual([
            {
                dedupe: "contract.expiring:c-1:2026-10-20",
                data: { contract_id: "c-1", ends_on: "2026-10-20", days_left: 8 },
            },
            {
                dedupe: "contract.expiring:c-3:2026-11-02",
                data: { contract_id: "c-3", ends_on: "2026-11-02", days_left: 21 },
            },
        ])
        expect(planContractScan(contracts, new Set(), "2026-10-12", 1)).toHaveLength(1)
    })
})

describe("previousMonth", () => {
    it("is the month before the one a day is in, across a year", () => {
        expect(previousMonth("2026-10-12")).toBe("2026-09")
        expect(previousMonth("2027-01-01")).toBe("2026-12")
    })
})

describe("planN8nSchedule", () => {
    it("starts a daily workflow in the three hours after its time", () => {
        expect(planN8nSchedule("schedule.daily", { time: "16:00" }, NOW)).toEqual({
            data: { date: "2026-10-12" },
            dedupe: "day:2026-10-12",
        })
        expect(planN8nSchedule("schedule.daily", { time: "20:00" }, NOW)).toBeNull()
        expect(planN8nSchedule("schedule.daily", { time: "10:00" }, NOW)).toBeNull()
        expect(planN8nSchedule("schedule.daily", {}, new Date("2026-10-12T21:30:00.000Z"))).toBeNull()
        expect(planN8nSchedule("schedule.daily", {}, new Date("2026-10-12T17:30:00.000Z"))).not.toBeNull()
    })

    it("starts a monthly workflow only on the first day, for the month before", () => {
        const first = new Date("2026-11-01T02:00:00.000Z")

        expect(planN8nSchedule("schedule.monthly", { time: "08:00" }, first)).toEqual({
            data: { period: "2026-10" },
            dedupe: "month:2026-10",
        })
        expect(planN8nSchedule("schedule.monthly", { time: "08:00" }, NOW)).toBeNull()
        expect(planN8nSchedule("schedule.monthly", { time: "08:00" }, new Date("2026-10-12T02:00:00.000Z"))).toBeNull()
        expect(
            planN8nSchedule("schedule.monthly", { time: "08:00" }, new Date("2027-01-01T02:00:00.000Z"))?.data,
        ).toEqual({
            period: "2026-12",
        })
    })

    it("knows an empty scan", () => {
        expect(NO_SCAN).toEqual({ runs: [], events: [] })
    })
})
