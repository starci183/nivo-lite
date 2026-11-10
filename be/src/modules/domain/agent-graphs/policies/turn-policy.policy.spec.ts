import { policyValuesOf, savedNamesOf, sentLinesOf, settingsEntityOf, stepLinePrefixOf } from "./turn-policy.policy"

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
