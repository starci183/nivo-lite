import { Test } from "@nestjs/testing"
import { holdEndingOf, isStaleSlot, sayingOf, skippedBy, textOf, wakeTextOf } from "./background-work.policy"

const SUBJECT = Symbol("background-work.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { holdEndingOf, isStaleSlot, sayingOf, skippedBy, textOf, wakeTextOf } },
        ],
    }).compile()
    return moduleRef.get<{
        holdEndingOf: typeof holdEndingOf
        isStaleSlot: typeof isStaleSlot
        sayingOf: typeof sayingOf
        skippedBy: typeof skippedBy
        textOf: typeof textOf
        wakeTextOf: typeof wakeTextOf
    }>(SUBJECT)
}

const NOW = new Date("2026-11-10T03:00:00.000Z")
const HOUR = 3_600_000

describe("holdEndingOf", () => {
    it("skips a background wake that the gates stopped, with their reason", async () => {
        const { holdEndingOf } = await build()

        for (const reason of ["quota", "breaker", "daily_cap", "openclaw_not_configured"]) {
            expect(holdEndingOf(reason)).toEqual({ status: "skipped", reason, outcome: null })
        }
    })

    it("holds a wake a switch stopped, and calls any other reason unavailable", async () => {
        const { holdEndingOf } = await build()

        expect(holdEndingOf("killed")).toEqual({ status: "held", reason: "killed", outcome: null })
        expect(holdEndingOf("openclaw_unavailable")).toEqual({
            status: "skipped",
            reason: "unavailable",
            outcome: null,
        })
    })
})

describe("skippedBy", () => {
    it("ends a wake as skipped with the reason", async () => {
        const { skippedBy } = await build()

        expect(skippedBy("no_work")).toEqual({ status: "skipped", reason: "no_work", outcome: null })
    })
})

describe("isStaleSlot", () => {
    it("is stale only after one period of the trigger", async () => {
        const { isStaleSlot } = await build()
        const at = (ms: number): string => String(NOW.getTime() - ms)

        expect(isStaleSlot(at(HOUR), "hourly", NOW)).toBe(false)
        expect(isStaleSlot(at(HOUR + 1), "hourly", NOW)).toBe(true)
        expect(isStaleSlot(at(15 * 60_000 + 1), "every_15m", NOW)).toBe(true)
    })

    it("is not stale without a slot, a trigger or a readable slot", async () => {
        const { isStaleSlot } = await build()

        expect(isStaleSlot(undefined, "hourly", NOW)).toBe(false)
        expect(isStaleSlot(String(NOW.getTime() - 99 * HOUR), null, NOW)).toBe(false)
        expect(isStaleSlot("later", "hourly", NOW)).toBe(false)
    })
})

describe("wakeTextOf", () => {
    it("starts from the probe's brief and names the event, the record, the task and the check by id", async () => {
        const { wakeTextOf } = await build()

        expect(
            wakeTextOf(
                { eventName: "bank_credit_booked", subjectId: "tx-1", taskId: "task-1", probeKey: "money_in" },
                "Money in: 5,000,000.",
            ),
        ).toBe("Money in: 5,000,000.\nevent: bank_credit_booked\nsubject: tx-1\ntask: task-1\ncheck: money_in")
    })

    it("is empty for a wake that carries nothing", async () => {
        const { wakeTextOf } = await build()

        expect(wakeTextOf({}, null)).toBe("")
        expect(wakeTextOf({}, "")).toBe("")
    })
})

describe("sayingOf", () => {
    it("says the reply, else the reason a person is wanted, else nothing", async () => {
        const { sayingOf } = await build()

        expect(sayingOf("  Done.  ", false, "")).toBe("Done.")
        expect(sayingOf("", true, " Please check. ")).toBe("Please check.")
        expect(sayingOf("  ", false, "unused")).toBe("")
    })
})

describe("textOf", () => {
    it("reads a text, a number or a flag as text, and anything else as empty", async () => {
        const { textOf } = await build()

        expect(textOf("run-9")).toBe("run-9")
        expect(textOf(7)).toBe("7")
        expect(textOf(true)).toBe("true")
        expect(textOf(undefined)).toBe("")
        expect(textOf({})).toBe("")
    })
})
