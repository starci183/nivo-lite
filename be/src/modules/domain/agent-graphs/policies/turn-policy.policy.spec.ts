import {
    alreadySentOf,
    leadStopsQueryOf,
    ledgerLinesOf,
    policyValuesOf,
    savedNamesOf,
    sentLinesOf,
    settingsEntityOf,
    stepLedgerQueryOf,
    stepLinePrefixOf,
    stepPlaceOf,
    stopCounts,
    stopToldOf,
} from "./turn-policy.policy"

describe("policyValuesOf", () => {
    it("replaces a default by the workspace's saved value of the same name and kind, and keeps every other default", () => {
        const defaults = { approvalThresholdVnd: 5_000_000, refund: "never", autoWon: true }
        expect(policyValuesOf(defaults, { approvalThresholdVnd: 3_000_000, autoWon: false, other: 1 })).toEqual({
            approvalThresholdVnd: 3_000_000,
            refund: "never",
            autoWon: false,
        })
    })

    it("keeps the default when the saved value is of another kind, is no number, or is missing", () => {
        const defaults = { approvalThresholdVnd: 5_000_000, refund: "never" }
        expect(policyValuesOf(defaults, { approvalThresholdVnd: "3000000", refund: null })).toEqual(defaults)
        expect(policyValuesOf(defaults, { approvalThresholdVnd: Number.NaN })).toEqual(defaults)
        expect(policyValuesOf({}, { approvalThresholdVnd: 1 })).toEqual({})
    })
})

describe("savedNamesOf and settingsEntityOf", () => {
    it("names the settings entity of a module and the policy names its record has a field for", () => {
        expect(settingsEntityOf("sales")).toBe("sales.settings")
        expect(savedNamesOf({ approvalThresholdVnd: 1, refund: "never" }, ["key", "approvalThresholdVnd"])).toEqual([
            "approvalThresholdVnd",
        ])
    })
})

describe("sentLinesOf", () => {
    const STEP = "run-1:create-order"

    it("keeps the lines kept under the step's own key, oldest first, with their words and time", () => {
        const rows = [
            { channelRef: `${stepLinePrefixOf(STEP)}bbbb`, text: "Đơn đã được duyệt ạ.", sentAt: "2026-11-10T03:05:00.000Z" },
            { channelRef: `${stepLinePrefixOf(STEP)}aaaa`, text: "Dạ shop đang kiểm tra ạ.", sentAt: new Date("2026-11-10T03:00:00.000Z") },
        ]
        expect(sentLinesOf(rows, STEP)).toEqual([
            { text: "Dạ shop đang kiểm tra ạ.", at: "2026-11-10T03:00:00.000Z" },
            { text: "Đơn đã được duyệt ạ.", at: "2026-11-10T03:05:00.000Z" },
        ])
    })

    it("leaves out a line of another step, a line with no key, no words or no time", () => {
        const rows = [
            { channelRef: "line:run-1:create-order-2:aaaa", text: "x", sentAt: "2026-11-10T03:00:00.000Z" },
            { channelRef: "line:run-2:create-order:aaaa", text: "x", sentAt: "2026-11-10T03:00:00.000Z" },
            { channelRef: null, text: "x", sentAt: "2026-11-10T03:00:00.000Z" },
            { channelRef: `${stepLinePrefixOf(STEP)}cccc`, text: "", sentAt: "2026-11-10T03:00:00.000Z" },
            { channelRef: `${stepLinePrefixOf(STEP)}dddd`, text: "x", sentAt: null },
        ]
        expect(sentLinesOf(rows, STEP)).toEqual([])
    })
})

describe("stepPlaceOf", () => {
    it("reads the run and the step of a step key, and nothing of another key", () => {
        expect(stepPlaceOf("run-1:create-order")).toEqual({ runId: "run-1", stepKey: "create-order" })
        expect(stepPlaceOf("run-1:loop:item")).toEqual({ runId: "run-1", stepKey: "loop:item" })
        expect(stepPlaceOf("k")).toBeNull()
        expect(stepPlaceOf(":x")).toBeNull()
        expect(stepPlaceOf("run-1:")).toBeNull()
    })
})

describe("ledgerLinesOf", () => {
    it("keeps the words of the customer sends whose arguments were kept, oldest first, at the time they were kept", () => {
        const rows = [
            { data: { effectId: "customer.message.send", args: { conversationId: "c-2", text: "B" } }, createdAt: "2026-11-10T03:05:00.000Z" },
            { data: { effectId: "customer.message.send", args: { leadId: "l-1", text: "A" } }, createdAt: "2026-11-10T03:00:00.000Z" },
            { data: { effectId: "team.message.post", args: { text: "team" } }, createdAt: "2026-11-10T03:01:00.000Z" },
            { data: { effectId: "customer.message.send", args: null }, createdAt: "2026-11-10T03:02:00.000Z" },
            { data: { effectId: "customer.message.send" }, createdAt: "2026-11-10T03:03:00.000Z" },
        ]
        expect(ledgerLinesOf(rows, ["customer.message.send"])).toEqual([
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
        ])
    })
})

describe("stopToldOf and stopCounts", () => {
    const NOW = new Date("2026-11-10T05:00:00.000Z")

    it("reads a stop's run, step, lines and resolution, and leaves out a line with no words or time", () => {
        expect(
            stopToldOf({
                runId: "run-1",
                stepKey: "match",
                customerLines: {
                    lines: [
                        { conversationId: "c-1", text: "Da nhan", at: "2026-11-10T03:00:00.000Z" },
                        { conversationId: "c-1", text: "", at: "2026-11-10T03:00:00.000Z" },
                        { conversationId: "c-1", text: "no time" },
                    ],
                },
                resolvedAt: null,
            }),
        ).toEqual({
            runId: "run-1",
            stepKey: "match",
            lines: [{ text: "Da nhan", at: "2026-11-10T03:00:00.000Z" }],
            resolvedAt: null,
        })
        expect(stopToldOf({ stepKey: "match" })).toBeNull()
        expect(stopToldOf({ runId: "run-1", stepKey: "match", customerLines: null })?.lines).toEqual([])
    })

    it("counts an open stop always, a resolved one within the day only, and with no clock only an open one", () => {
        const open = { runId: "r", stepKey: "s", lines: [], resolvedAt: null }
        const recent = { ...open, resolvedAt: "2026-11-09T06:00:00.000Z" }
        const old = { ...open, resolvedAt: "2026-11-09T04:59:59.000Z" }
        expect(stopCounts(open, NOW)).toBe(true)
        expect(stopCounts(recent, NOW)).toBe(true)
        expect(stopCounts(old, NOW)).toBe(false)
        expect(stopCounts(open, null)).toBe(true)
        expect(stopCounts(recent, null)).toBe(false)
    })
})

describe("alreadySentOf", () => {
    it("keeps each wording once at its first time, oldest first, the newest twenty only", () => {
        const lines = [
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "A", at: "2026-11-10T03:09:00.000Z" },
        ]
        expect(alreadySentOf(lines)).toEqual([
            { text: "A", at: "2026-11-10T03:00:00.000Z" },
            { text: "B", at: "2026-11-10T03:05:00.000Z" },
        ])
        const many = Array.from({ length: 25 }, (_, index) => ({
            text: `L${index}`,
            at: new Date(Date.UTC(2026, 10, 10, 0, index)).toISOString(),
        }))
        expect(alreadySentOf(many).map((line) => line.text)).toEqual(many.slice(5).map((line) => line.text))
    })
})

describe("the reads of what a customer was told", () => {
    it("reads a step's ledger records by run and step, and a customer's stops by customer and state", () => {
        expect(stepLedgerQueryOf({ runId: "run-1", stepKey: "match" })).toMatchObject({
            from: "agent.node-effect",
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "runId", value: "run-1" },
                    { op: "eq", field: "stepKey", value: "match" },
                ],
            },
            order: [["id", "asc"]],
        })
        expect(leadStopsQueryOf("lead-1", "open")).toMatchObject({
            from: "agent.run-stop",
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "leadId", value: "lead-1" },
                    { op: "eq", field: "state", value: "open" },
                ],
            },
        })
    })
})
